/**
 * @fileoverview Deterministic validation of a structured ChangePlan against FalkorDB.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { queryLegacyImpact } from '../review/falkor-review.helper';
import { ChatCypherService } from '../chat/chat-cypher.service';
import { ChatService } from '../chat/chat.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { ProjectsService } from '../projects/projects.service';
import { SyncStatusService } from '../projects/sync-status.service';
import type { ChatScope } from '../chat/chat-scope.util';
import {
  CHANGE_PLAN_SCHEMA_VERSION,
  type ChangePlan,
  type PlanCheckStatus,
  type PlanValidationCheck,
  type PlanValidationFileResult,
  type PlanValidationReport,
  type PlanVerdict,
} from './change-plan-validation.types';

const MAX_FILES = 50;
const MAX_SYMBOLS_PER_FILE = 8;
const RECOMPUTE_GAP_FAIL_MIN = 3;

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

function pathVariants(path: string): string[] {
  const n = normalizePath(path);
  const set = new Set<string>([n]);
  if (!n.startsWith('src/')) set.add(`src/${n}`);
  const base = n.split('/').pop() ?? n;
  if (base !== n) set.add(base);
  return [...set];
}

@Injectable()
export class ChangePlanValidationService {
  private readonly logger = new Logger(ChangePlanValidationService.name);

  constructor(
    private readonly cypher: ChatCypherService,
    private readonly chat: ChatService,
    private readonly repos: RepositoriesService,
    private readonly projects: ProjectsService,
    private readonly syncStatus: SyncStatusService,
  ) {}

  /** Validates a change plan against the indexed graph for the given project/repo. */
  async validate(projectIdParam: string, raw: ChangePlan): Promise<PlanValidationReport> {
    const plan = this.normalizeInput(projectIdParam, raw);
    const checks: PlanValidationCheck[] = [];
    const fileResults: PlanValidationFileResult[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];
    const suggestedFixes: { checkId: string; action: string }[] = [];

    const graphProjectId = await this.resolveGraphProjectId(plan.projectId);
    if (!graphProjectId) {
      return this.buildReport(checks, fileResults, blockers, warnings, suggestedFixes, {
        missingFromPlan: [],
        extraInPlan: plan.files.map((f) => f.path),
        referenceOverlapRatio: 0,
      });
    }

    const freshness = await this.syncStatus.getStatusForProjectOrRepo(plan.projectId);
    if (freshness.stale && this.syncStatus.isStaleBlocked()) {
      checks.push({
        id: 'INDEX_STALE',
        status: 'fail',
        message: `Graph index stale (last sync: ${freshness.lastSync ?? 'never'}). Run resync before planning.`,
      });
      blockers.push('INDEX_STALE: resync required before validate_change_plan');
      suggestedFixes.push({
        checkId: 'INDEX_STALE',
        action: freshness.recommendation ?? 'Run full resync on all project repositories.',
      });
    } else if (freshness.stale) {
      checks.push({
        id: 'INDEX_STALE',
        status: 'warn',
        message: 'Graph may be stale; CHANGE_PLAN_ALLOW_STALE is set.',
      });
      warnings.push('Index stale but validation allowed by CHANGE_PLAN_ALLOW_STALE');
    } else {
      checks.push({
        id: 'INDEX_STALE',
        status: 'pass',
        message: 'Graph index freshness OK',
      });
    }

    const indexedPaths = await this.loadIndexedPaths(graphProjectId);
    const referencePaths = new Set(
      (plan.referencePlan?.filesToModify ?? []).map((f) => normalizePath(f.path)),
    );

    const planPaths = plan.files.slice(0, MAX_FILES).map((f) => normalizePath(f.path));
    const missingFromPlan: string[] = [];
    const extraInPlan: string[] = [];

    for (const file of plan.files.slice(0, MAX_FILES)) {
      const path = normalizePath(file.path);
      const exists = this.pathExistsInIndex(path, indexedPaths);

      let symbolsResolved = true;
      const symbols = (file.symbols ?? []).slice(0, MAX_SYMBOLS_PER_FILE);
      for (const sym of symbols) {
        const ok = await this.symbolExistsInProject(graphProjectId, sym.trim());
        if (!ok) symbolsResolved = false;
      }

      let impactSummary: string | undefined;
      let dependentCount: number | undefined;
      const primarySymbol = symbols[0]?.trim();
      if (primarySymbol) {
        try {
          const impact = await queryLegacyImpact(primarySymbol, graphProjectId);
          dependentCount = impact.dependents;
          if (impact.dependents > 0) {
            impactSummary = `${impact.dependents} dependent(s); risk ${impact.breakingRisk}`;
            if (impact.breakingRisk === 'high') {
              warnings.push(`High legacy impact on \`${primarySymbol}\` in \`${path}\`.`);
            }
          }
        } catch (err) {
          this.logger.debug(`Impact query failed for ${primarySymbol}: ${err}`);
        }
      }

      fileResults.push({
        path,
        existsInGraph: exists || file.changeType === 'add',
        symbolsResolved: symbols.length === 0 || symbolsResolved,
        inReferencePlan: referencePaths.has(path),
        impactSummary,
        dependentCount,
      });

      if (!exists && file.changeType !== 'add') {
        checks.push({
          id: 'FILE_EXISTS',
          status: 'fail',
          message: `Path not found in indexed graph: ${path}`,
          paths: [path],
        });
        blockers.push(`File not in graph: ${path}`);
        suggestedFixes.push({
          checkId: 'FILE_EXISTS',
          action: `Remove ${path} or mark changeType "add" if creating a new file.`,
        });
      } else {
        checks.push({
          id: 'FILE_EXISTS',
          status: 'pass',
          message: exists ? `Indexed: ${path}` : `New file (add): ${path}`,
          paths: [path],
        });
      }

      if (symbols.length > 0 && !symbolsResolved) {
        checks.push({
          id: 'SYMBOL_UNRESOLVED',
          status: 'fail',
          message: `Symbol(s) not found for ${path}: ${symbols.join(', ')}`,
          paths: [path],
        });
        blockers.push(`Unresolved symbol in ${path}`);
        suggestedFixes.push({
          checkId: 'SYMBOL_UNRESOLVED',
          action: 'Verify symbol names with get_definitions or remove invalid symbols.',
        });
      }
    }

    let referenceOverlapRatio: number | undefined;
    if (referencePaths.size > 0 && planPaths.length > 0) {
      const overlap = planPaths.filter((p) => referencePaths.has(p)).length;
      referenceOverlapRatio = overlap / Math.max(referencePaths.size, planPaths.length);
      const status: PlanCheckStatus =
        referenceOverlapRatio >= 0.5 ? 'pass' : referenceOverlapRatio >= 0.25 ? 'warn' : 'fail';
      checks.push({
        id: 'REFERENCE_OVERLAP',
        status,
        message: `Overlap with reference plan: ${Math.round((referenceOverlapRatio ?? 0) * 100)}%`,
      });
      if (status === 'warn') {
        warnings.push(
          `Low overlap (${Math.round(referenceOverlapRatio * 100)}%) with Gate-1 modification plan.`,
        );
      } else if (status === 'fail') {
        blockers.push('Plan diverges strongly from Ariadne modification-plan reference.');
      }
    }

    const desc =
      plan.changeDescription?.trim() || plan.changeScope?.description?.trim() || '';
    if (desc.length > 8) {
      try {
        const scope = plan.scope as ChatScope | undefined;
        const refFiles = await this.chat.getModificationPlanFilesOnlyByProject(
          plan.projectId,
          desc.slice(0, 4000),
          scope,
        );
        const refSet = new Set(refFiles.map((f) => normalizePath(f.path)));
        const planSet = new Set(planPaths);
        for (const rp of refSet) {
          if (!planSet.has(rp)) missingFromPlan.push(rp);
        }
        for (const pp of planSet) {
          if (!refSet.has(pp) && !this.pathExistsInIndex(pp, indexedPaths)) {
            extraInPlan.push(pp);
          }
        }
        if (missingFromPlan.length > 0) {
          const gapStatus: PlanCheckStatus =
            missingFromPlan.length > RECOMPUTE_GAP_FAIL_MIN &&
            (referenceOverlapRatio ?? 1) < 0.25
              ? 'fail'
              : 'warn';
          checks.push({
            id: 'RECOMPUTE_GAP',
            status: gapStatus,
            message: `${missingFromPlan.length} file(s) from modification-plan missing in submitted plan`,
            paths: missingFromPlan.slice(0, 10),
          });
          const msg = `Ariadne suggests adding: ${missingFromPlan.slice(0, 5).join(', ')}${missingFromPlan.length > 5 ? '…' : ''}`;
          if (gapStatus === 'fail') blockers.push(msg);
          else warnings.push(msg);
        } else {
          checks.push({
            id: 'RECOMPUTE_GAP',
            status: 'pass',
            message: 'Submitted plan covers modification-plan file candidates',
          });
        }
      } catch (err) {
        this.logger.warn(`RECOMPUTE_GAP skipped: ${err}`);
      }
    }

    const taskFiles = new Set<string>();
    for (const t of plan.tasks ?? []) {
      for (const f of t.files ?? []) taskFiles.add(normalizePath(f));
    }
    if (taskFiles.size > 0) {
      const planSet = new Set(planPaths);
      const uncovered = [...taskFiles].filter((f) => !planSet.has(f));
      if (uncovered.length > 0) {
        checks.push({
          id: 'TASK_FILE_COVERAGE',
          status: 'warn',
          message: `${uncovered.length} task file(s) not listed in plan.files`,
          paths: uncovered.slice(0, 10),
        });
        warnings.push(`Tasks reference files not in plan.files: ${uncovered.slice(0, 3).join(', ')}`);
      } else {
        checks.push({
          id: 'TASK_FILE_COVERAGE',
          status: 'pass',
          message: 'All task files appear in plan.files',
        });
      }
    }

    for (const api of plan.apiChanges ?? []) {
      const method = (api.method ?? 'GET').toUpperCase();
      if (api.changeType === 'remove') {
        const exists = await this.endpointExists(graphProjectId, method, api.path);
        if (exists) {
          const hasDeps = await this.endpointHasFrontendDependents(graphProjectId, method, api.path);
          const status: PlanCheckStatus = hasDeps ? 'fail' : 'warn';
          checks.push({
            id: 'ENDPOINT_REMOVE_UNSAFE',
            status,
            message: hasDeps
              ? `Removing indexed endpoint ${method} ${api.path} — front/API dependents in graph`
              : `Removing indexed endpoint ${method} ${api.path} — verify impact`,
          });
          if (hasDeps) {
            blockers.push(`Endpoint removal blocked: ${method} ${api.path} has graph dependents`);
          } else {
            warnings.push(`Endpoint removal: ${method} ${api.path}`);
          }
        }
      } else if (api.changeType === 'modify') {
        const exists = await this.endpointExists(graphProjectId, method, api.path);
        checks.push({
          id: 'ENDPOINT_EXISTS',
          status: exists ? 'pass' : 'warn',
          message: exists
            ? `Endpoint found: ${method} ${api.path}`
            : `Endpoint not in graph (may be new): ${method} ${api.path}`,
        });
      }
    }

    return this.buildReport(checks, fileResults, blockers, warnings, suggestedFixes, {
      missingFromPlan,
      extraInPlan,
      referenceOverlapRatio,
    });
  }

  private normalizeInput(projectIdParam: string, raw: ChangePlan): ChangePlan {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Request body must be a ChangePlan object');
    }
    const files = Array.isArray(raw.files) ? raw.files : [];
    if (files.length === 0) {
      throw new BadRequestException('ChangePlan.files must be a non-empty array');
    }
    if (files.length > MAX_FILES) {
      throw new BadRequestException(`ChangePlan.files exceeds max ${MAX_FILES}`);
    }
    return {
      schemaVersion: CHANGE_PLAN_SCHEMA_VERSION,
      projectId: (raw.projectId ?? projectIdParam).trim(),
      source: raw.source ?? 'mcp',
      changeDescription: raw.changeDescription,
      changeScope: raw.changeScope,
      files: files.map((f) => ({
        path: normalizePath(f.path),
        repoId: f.repoId,
        changeType: f.changeType ?? 'modify',
        symbols: f.symbols,
      })),
      apiChanges: raw.apiChanges,
      tasks: raw.tasks,
      referencePlan: raw.referencePlan,
      scope: raw.scope,
    };
  }

  private async resolveGraphProjectId(projectOrRepoId: string): Promise<string | null> {
    const id = projectOrRepoId.trim();
    if (!id) return null;
    try {
      const repo = await this.repos.findOne(id).catch(() => null);
      if (repo?.id) {
        const ids = await this.repos.getProjectIdsForRepo(repo.id);
        return ids[0] ?? repo.id;
      }
      const proj = await this.projects.findOne(id).catch(() => null);
      if (proj?.id) return proj.id;
    } catch {
      /* fallback */
    }
    return id;
  }

  private async loadIndexedPaths(graphProjectId: string): Promise<Set<string>> {
    const rows = (await this.cypher.executeCypher(
      graphProjectId,
      `MATCH (f:File) WHERE f.projectId = $projectId RETURN f.path AS path`,
      {},
    )) as Array<{ path?: string }>;
    const set = new Set<string>();
    for (const r of rows) {
      const p = normalizePath(String(r.path ?? ''));
      if (p) set.add(p);
    }
    return set;
  }

  private pathExistsInIndex(path: string, indexed: Set<string>): boolean {
    for (const v of pathVariants(path)) {
      if (indexed.has(v)) return true;
      for (const ip of indexed) {
        if (ip.endsWith(`/${v}`) || ip === v) return true;
      }
    }
    return false;
  }

  private async symbolExistsInProject(
    graphProjectId: string,
    symbolName: string,
  ): Promise<boolean> {
    if (!symbolName) return true;
    const rows = (await this.cypher.executeCypher(
      graphProjectId,
      `MATCH (n)
       WHERE n.projectId = $projectId AND n.name = $name
       AND (n:Component OR n:Function OR n:Class OR n:Hook)
       RETURN n.name AS name LIMIT 5`,
      { name: symbolName },
    )) as Array<{ name?: string }>;
    return rows.length > 0;
  }

  private async endpointExists(
    graphProjectId: string,
    method: string,
    path: string,
  ): Promise<boolean> {
    const rows = (await this.cypher.executeCypher(
      graphProjectId,
      `MATCH (e:API_Endpoint)
       WHERE e.projectId = $projectId
       AND toUpper(coalesce(e.method, '')) = $method
       AND (e.path = $path OR e.route = $path OR e.url = $path)
       RETURN e.path AS path LIMIT 1`,
      { method: method.toUpperCase(), path },
    )) as Array<{ path?: string }>;
    return rows.length > 0;
  }

  private async endpointHasFrontendDependents(
    graphProjectId: string,
    method: string,
    path: string,
  ): Promise<boolean> {
    const depRows = (await this.cypher.executeCypher(
      graphProjectId,
      `MATCH (op:OpenApiOperation)
       WHERE op.projectId = $projectId
       AND toUpper(coalesce(op.method, '')) = $method
       AND (op.path = $path OR op.route = $path)
       MATCH ()-[r:CALLS_API|CALLS_NEST_ROUTE|ENTRY_REACHES_API]->(op)
       RETURN count(r) AS c LIMIT 1`,
      { method: method.toUpperCase(), path },
    )) as Array<{ c?: number }>;
    if (Number(depRows[0]?.c ?? 0) > 0) return true;
    const apiRows = (await this.cypher.executeCypher(
      graphProjectId,
      `MATCH (e:API_Endpoint)
       WHERE e.projectId = $projectId
       AND toUpper(coalesce(e.method, '')) = $method
       AND (e.path = $path OR e.route = $path OR e.url = $path)
       MATCH ()-[r:CALLS_API|CALLS_NEST_ROUTE|ENTRY_REACHES_API]->(e)
       RETURN count(r) AS c LIMIT 1`,
      { method: method.toUpperCase(), path },
    )) as Array<{ c?: number }>;
    return Number(apiRows[0]?.c ?? 0) > 0;
  }

  private buildReport(
    checks: PlanValidationCheck[],
    fileResults: PlanValidationFileResult[],
    blockers: string[],
    warnings: string[],
    suggestedFixes: { checkId: string; action: string }[],
    coverage: PlanValidationReport['coverage'],
  ): PlanValidationReport {
    const hasFail = checks.some((c) => c.status === 'fail');
    const hasWarn = checks.some((c) => c.status === 'warn') || warnings.length > 0;

    let verdict: PlanVerdict = 'APPROVED';
    if (hasFail || blockers.length > 0) verdict = 'BLOCKED';
    else if (hasWarn) verdict = 'APPROVED_WITH_WARNINGS';

    const passCount = checks.filter((c) => c.status === 'pass').length;
    const score =
      checks.length === 0
        ? 50
        : Math.round((passCount / checks.length) * 100 - (hasFail ? 40 : 0) - (hasWarn ? 10 : 0));

    const summary =
      verdict === 'APPROVED'
        ? 'Plan aligns with indexed codebase.'
        : verdict === 'APPROVED_WITH_WARNINGS'
          ? `Plan acceptable with ${warnings.length} warning(s).`
          : `Plan blocked: ${blockers.length} issue(s).`;

    return {
      schemaVersion: CHANGE_PLAN_SCHEMA_VERSION,
      verdict,
      score: Math.max(0, Math.min(100, score)),
      summary,
      checks,
      fileResults,
      coverage,
      blockers: [...new Set(blockers)],
      warnings: [...new Set(warnings)],
      suggestedFixes,
    };
  }
}
