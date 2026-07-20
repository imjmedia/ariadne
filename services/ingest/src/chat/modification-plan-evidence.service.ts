/**
 * @fileoverview Graph enrichment for modification-plan files + ChangePlan task seeds.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ChatCypherService } from './chat-cypher.service';
import { normalizePathKey } from './chat-scope.util';
import {
  applyDependentBoost,
  mergeImpactExpandedFiles,
  suggestPhaseForRank,
  type ImpactRankedFile,
} from './modification-plan-impact-expand.util';
import type {
  GraphEvidenceBundle,
  GraphEvidenceEndpoint,
  GraphEvidenceFile,
  GraphEvidenceProp,
  GraphEvidenceRef,
  ModificationPlanTaskSeed,
} from './modification-plan-evidence.types';
import type { ChangePlan, ChangePlanTask } from '../plan-validation/change-plan-validation.types';
import { CHANGE_PLAN_SCHEMA_VERSION } from '../plan-validation/change-plan-validation.types';

const DEFAULT_EVIDENCE_MAX = 40;
const DEFAULT_EXPAND_SEED_LIMIT = 25;
const SYMBOLS_PER_FILE = 8;

function envInt(name: string, fallback: number, max: number): number {
  const raw = process.env[name]?.trim();
  const n = raw ? parseInt(raw, 10) : fallback;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

@Injectable()
export class ModificationPlanEvidenceService {
  private readonly logger = new Logger(ModificationPlanEvidenceService.name);

  constructor(private readonly cypher: ChatCypherService) {}

  /**
   * Expand seed files 1–2 hops via IMPORTS / CALLS / RENDERS and rank by impact.
   */
  async expandAndRankByImpact(
    projectId: string,
    seeds: Array<{ path: string; repoId: string }>,
    maxFiles: number,
  ): Promise<Array<{ path: string; repoId: string; impactScore: number }>> {
    if (seeds.length === 0) return [];
    const seedLimit = envInt('MODIFICATION_PLAN_IMPACT_SEED_LIMIT', DEFAULT_EXPAND_SEED_LIMIT, 80);
    const seedSlice = seeds.slice(0, seedLimit);
    const paths = seedSlice.map((s) => normalizePathKey(s.path)).filter(Boolean);

    const expanded: Array<{ path: string; repoId: string; hopBonus?: number }> = [];
    try {
      const importRows = (await this.cypher.executeCypher(
        projectId,
        `MATCH (f:File) WHERE f.projectId = $projectId AND f.path IN $paths
         MATCH (f)-[:IMPORTS]->(other:File)
         WHERE other.projectId = $projectId
         RETURN DISTINCT other.path AS path, coalesce(other.repoId, other.projectId) AS repoId, 80 AS hopBonus
         LIMIT 200`,
        { paths },
      )) as Array<{ path: string; repoId: string; hopBonus: number }>;
      for (const r of importRows) {
        if (r?.path) expanded.push({ path: r.path, repoId: String(r.repoId), hopBonus: Number(r.hopBonus) || 80 });
      }

      const importInRows = (await this.cypher.executeCypher(
        projectId,
        `MATCH (f:File) WHERE f.projectId = $projectId AND f.path IN $paths
         MATCH (other:File)-[:IMPORTS]->(f)
         WHERE other.projectId = $projectId
         RETURN DISTINCT other.path AS path, coalesce(other.repoId, other.projectId) AS repoId, 90 AS hopBonus
         LIMIT 200`,
        { paths },
      )) as Array<{ path: string; repoId: string; hopBonus: number }>;
      for (const r of importInRows) {
        if (r?.path) expanded.push({ path: r.path, repoId: String(r.repoId), hopBonus: Number(r.hopBonus) || 90 });
      }

      const callOutRows = (await this.cypher.executeCypher(
        projectId,
        `MATCH (f:File)-[:CONTAINS]->(n) WHERE f.projectId = $projectId AND f.path IN $paths
         MATCH (n)-[:CALLS|RENDERS|IMPORTS]->(dep)
         MATCH (df:File)-[:CONTAINS]->(dep) WHERE df.projectId = $projectId
         RETURN DISTINCT df.path AS path, coalesce(df.repoId, df.projectId) AS repoId, 60 AS hopBonus
         LIMIT 200`,
        { paths },
      )) as Array<{ path: string; repoId: string; hopBonus: number }>;
      for (const r of callOutRows) {
        if (r?.path) expanded.push({ path: r.path, repoId: String(r.repoId), hopBonus: Number(r.hopBonus) || 60 });
      }

      const callInRows = (await this.cypher.executeCypher(
        projectId,
        `MATCH (f:File)-[:CONTAINS]->(n) WHERE f.projectId = $projectId AND f.path IN $paths
         MATCH (n)<-[:CALLS|RENDERS|IMPORTS]-(dep)
         MATCH (df:File)-[:CONTAINS]->(dep) WHERE df.projectId = $projectId
         RETURN DISTINCT df.path AS path, coalesce(df.repoId, df.projectId) AS repoId, 70 AS hopBonus
         LIMIT 200`,
        { paths },
      )) as Array<{ path: string; repoId: string; hopBonus: number }>;
      for (const r of callInRows) {
        if (r?.path) expanded.push({ path: r.path, repoId: String(r.repoId), hopBonus: Number(r.hopBonus) || 70 });
      }
    } catch (err) {
      this.logger.warn(`Impact expand failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    let ranked = mergeImpactExpandedFiles(seedSlice, expanded, { maxFiles });
    const depCounts = await this.countDependentsByFilePath(projectId, ranked.map((r) => r.path));
    ranked = applyDependentBoost(ranked, depCounts);
    return ranked.slice(0, maxFiles).map((r) => ({
      path: r.path,
      repoId: r.repoId,
      impactScore: r.impactScore,
    }));
  }

  /** Build per-file evidence bundle (symbols, dependents, props, API touches). */
  async buildEvidenceBundle(
    projectId: string,
    files: Array<{ path: string; repoId: string; impactScore?: number }>,
  ): Promise<GraphEvidenceBundle> {
    const max = envInt('MODIFICATION_PLAN_EVIDENCE_MAX_FILES', DEFAULT_EVIDENCE_MAX, 80);
    const slice = files.slice(0, max);
    const enriched: GraphEvidenceFile[] = [];

    for (const f of slice) {
      const path = normalizePathKey(f.path);
      try {
        const symbols = await this.loadSymbolsForFile(projectId, path);
        const dependents = await this.loadDependentsForSymbols(projectId, symbols.slice(0, 3));
        const props = await this.loadPropsForComponents(projectId, symbols);
        const apiTouches = await this.loadApiTouchesForFile(projectId, path);
        const depBoost = dependents.reduce((s, d) => s + d.count, 0);
        enriched.push({
          path,
          repoId: f.repoId,
          symbols,
          dependents,
          props,
          apiTouches,
          impactScore: (f.impactScore ?? 0) + depBoost,
        });
      } catch (err) {
        this.logger.debug(`Evidence skip ${path}: ${err}`);
        enriched.push({
          path,
          repoId: f.repoId,
          symbols: [],
          dependents: [],
          props: [],
          apiTouches: [],
          impactScore: f.impactScore ?? 0,
        });
      }
    }

    enriched.sort((a, b) => b.impactScore - a.impactScore || a.path.localeCompare(b.path));

    return {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      projectId,
      files: enriched,
    };
  }

  /** Deterministic task seeds from evidence (one cluster per file / primary symbol). */
  buildTaskSeeds(bundle: GraphEvidenceBundle): ModificationPlanTaskSeed[] {
    const files = bundle.files;
    const tasks: ModificationPlanTaskSeed[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i]!;
      const primary = f.symbols[0] ?? basename(f.path);
      const id = `T${i + 1}`;
      const phase = suggestPhaseForRank(i, files.length);
      const depCount = f.dependents.reduce((s, d) => s + d.count, 0);
      const evidence: GraphEvidenceRef[] = [
        { kind: 'path', ref: f.path },
        ...f.symbols.slice(0, 4).map((s) => ({ kind: 'symbol' as const, ref: s })),
        ...f.apiTouches.slice(0, 3).map((e) => ({
          kind: 'endpoint' as const,
          ref: `${e.method} ${e.path}`,
        })),
        ...f.props.slice(0, 3).map((p) => ({
          kind: 'prop' as const,
          ref: `${p.component}.${p.name}`,
        })),
      ];
      const endpoints = f.apiTouches.map((e) => `${e.method} ${e.path}`);
      tasks.push({
        id,
        title: `Actualizar ${primary}`,
        files: [f.path],
        symbols: f.symbols.slice(0, SYMBOLS_PER_FILE),
        ...(endpoints.length ? { endpoints } : {}),
        phase,
        criterion: `Mantener contrato de ${primary}; dependents=${depCount}; sin romper imports indexados`,
        evidence,
        dependsOn: i > 0 && phase !== '1-core' ? [`T${Math.max(1, i)}`] : [],
      });
    }
    // Fix dependsOn: non-core depends on last core task
    const coreIds = tasks.filter((t) => t.phase === '1-core').map((t) => t.id);
    const coreAnchor = coreIds[coreIds.length - 1];
    return tasks.map((t) => {
      if (t.phase === '1-core' || !coreAnchor || t.id === coreAnchor) {
        return { ...t, dependsOn: [] };
      }
      return { ...t, dependsOn: [coreAnchor] };
    });
  }

  /** Full ChangePlan seed for Gate 2 / chat appendix / MCP template. */
  buildChangePlanSeed(opts: {
    projectId: string;
    changeDescription: string;
    source?: ChangePlan['source'];
    filesToModify: Array<{ path: string; repoId: string }>;
    bundle: GraphEvidenceBundle;
    questionsToRefine?: string[];
  }): ChangePlan {
    const tasks = this.buildTaskSeeds(opts.bundle) as ChangePlanTask[];
    const symbolByPath = new Map(
      opts.bundle.files.map((f) => [normalizePathKey(f.path), f.symbols] as const),
    );
    return {
      schemaVersion: CHANGE_PLAN_SCHEMA_VERSION,
      projectId: opts.projectId,
      source: opts.source ?? 'mcp',
      changeDescription: opts.changeDescription,
      referencePlan: {
        filesToModify: opts.filesToModify.map((f) => ({
          path: f.path,
          ...(f.repoId ? { repoId: f.repoId } : {}),
        })),
      },
      files: opts.filesToModify.map((f) => ({
        path: f.path,
        repoId: f.repoId,
        changeType: 'modify' as const,
        symbols: symbolByPath.get(normalizePathKey(f.path)) ?? [],
      })),
      tasks,
    };
  }

  /** Detect existing layer-folder patterns in the index (for reengineering prompt grounding). */
  async listExistingLayerFolders(projectId: string): Promise<string[]> {
    const patterns = ['/policies/', '/adapters/', '/services/', '/domain/', '/use-cases/', '/usecases/'];
    const found: string[] = [];
    try {
      for (const pat of patterns) {
        const rows = (await this.cypher.executeCypher(
          projectId,
          `MATCH (f:File) WHERE f.projectId = $projectId AND f.path CONTAINS $pat
           RETURN f.path AS path LIMIT 3`,
          { pat },
        )) as Array<{ path: string }>;
        if (rows.length > 0) found.push(pat.replace(/\//g, '').replace(/-$/, '') || pat);
      }
    } catch {
      /* ignore */
    }
    return [...new Set(found.map((p) => p.replace(/\//g, '')).filter(Boolean))];
  }

  private async loadSymbolsForFile(projectId: string, path: string): Promise<string[]> {
    const rows = (await this.cypher.executeCypher(
      projectId,
      `MATCH (f:File {path: $path, projectId: $projectId})-[:CONTAINS]->(n)
       WHERE n.name IS NOT NULL
       RETURN DISTINCT n.name AS name, labels(n) AS labels
       LIMIT $limit`,
      { path, limit: SYMBOLS_PER_FILE },
    )) as Array<{ name: string }>;
    return rows.map((r) => String(r.name)).filter(Boolean);
  }

  private async loadDependentsForSymbols(
    projectId: string,
    symbols: string[],
  ): Promise<GraphEvidenceFile['dependents']> {
    const out: GraphEvidenceFile['dependents'] = [];
    for (const symbol of symbols) {
      try {
        const rows = (await this.cypher.executeCypher(
          projectId,
          `MATCH (n {name: $name, projectId: $projectId})<-[:CALLS|RENDERS|IMPORTS]-(dependent)
           WHERE dependent.projectId = $projectId OR dependent.projectId IS NULL
           RETURN dependent.name AS name LIMIT 40`,
          { name: symbol },
        )) as Array<{ name: string }>;
        const count = rows.length;
        const breakingRisk: 'low' | 'medium' | 'high' =
          count > 10 ? 'high' : count > 3 ? 'medium' : 'low';
        out.push({ symbol, count, breakingRisk });
      } catch {
        out.push({ symbol, count: 0, breakingRisk: 'low' });
      }
    }
    return out;
  }

  private async loadPropsForComponents(
    projectId: string,
    symbols: string[],
  ): Promise<GraphEvidenceProp[]> {
    const props: GraphEvidenceProp[] = [];
    for (const component of symbols.slice(0, 4)) {
      try {
        const rows = (await this.cypher.executeCypher(
          projectId,
          `MATCH (c:Component {name: $name, projectId: $projectId})-[:HAS_PROP]->(p:Prop)
           RETURN p.name AS name, p.required AS required LIMIT 20`,
          { name: component },
        )) as Array<{ name: string; required?: boolean }>;
        for (const r of rows) {
          if (r?.name) {
            props.push({
              component,
              name: String(r.name),
              required: Boolean(r.required),
            });
          }
        }
      } catch {
        /* not a component */
      }
    }
    return props;
  }

  private async loadApiTouchesForFile(
    projectId: string,
    path: string,
  ): Promise<GraphEvidenceEndpoint[]> {
    try {
      const rows = (await this.cypher.executeCypher(
        projectId,
        `MATCH (f:File {path: $path, projectId: $projectId})-[:REFERENCES_API]->(ref:ApiClientReference)-[:CALLS_API]->(op:OpenApiOperation)
         RETURN coalesce(op.method, 'GET') AS method, coalesce(op.pathTemplate, ref.apiPath) AS path
         LIMIT 15`,
        { path },
      )) as Array<{ method: string; path: string }>;
      return rows
        .filter((r) => r?.path)
        .map((r) => ({ method: String(r.method || 'GET').toUpperCase(), path: String(r.path) }));
    } catch {
      return [];
    }
  }

  private async countDependentsByFilePath(
    projectId: string,
    paths: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (paths.length === 0) return map;
    try {
      const rows = (await this.cypher.executeCypher(
        projectId,
        `MATCH (f:File)-[:CONTAINS]->(n) WHERE f.projectId = $projectId AND f.path IN $paths
         MATCH (n)<-[:CALLS|RENDERS|IMPORTS]-(dependent)
         RETURN f.path AS path, count(dependent) AS cnt`,
        { paths: paths.map((p) => normalizePathKey(p)) },
      )) as Array<{ path: string; cnt: number }>;
      for (const r of rows) {
        if (r?.path) map.set(normalizePathKey(r.path), Number(r.cnt) || 0);
      }
    } catch (err) {
      this.logger.debug(`Dependent count failed: ${err}`);
    }
    return map;
  }
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

export type { ImpactRankedFile };
