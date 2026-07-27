/**
 * Fusiona snapshots MDD por repo en un documento único para import Forge multi-root.
 */
import type { MddEvidenceDocument, MddMultiRootBlock } from './mdd-document.types';
import { getMddBuilderLimits } from './mdd-limits';

export type MddMergeSource = {
  repositoryId: string;
  slug: string;
  mdd: MddEvidenceDocument;
  fromSnapshot: boolean;
  snapshotId?: string;
};

const TRUST_RANK: Record<MddEvidenceDocument['openapi_spec']['trust_level'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.filter((v) => typeof v === 'string' && v.length > 0))];
}

function dedupeEntities(entities: MddEvidenceDocument['entities']): MddEvidenceDocument['entities'] {
  const seen = new Set<string>();
  const out: MddEvidenceDocument['entities'] = [];
  for (const e of entities) {
    const key = `${e.source}:${e.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function routeKey(route: string, methods: string[]): string {
  return `${route}::${[...methods].sort().join(',')}`;
}

function dedupeApiContracts(
  contracts: MddEvidenceDocument['api_contracts'],
): MddEvidenceDocument['api_contracts'] {
  const seen = new Set<string>();
  const out: MddEvidenceDocument['api_contracts'] = [];
  for (const c of contracts) {
    const key = routeKey(c.route, c.methods);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function dedupeBusinessLogic(
  rows: MddEvidenceDocument['business_logic'],
): MddEvidenceDocument['business_logic'] {
  const byService = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!byService.has(row.service)) byService.set(row.service, new Set());
    for (const dep of row.dependencies) byService.get(row.service)!.add(dep);
  }
  return [...byService.entries()].map(([service, deps]) => ({
    service,
    dependencies: [...deps],
  }));
}

function mergeOpenApiSpec(
  specs: MddEvidenceDocument['openapi_spec'][],
): MddEvidenceDocument['openapi_spec'] {
  let best: MddEvidenceDocument['openapi_spec'] | null = null;
  let bestRank = 0;
  const swaggerRelatedPaths: string[] = [];
  const supplementaryDocPaths: string[] = [];
  const supplementaryDocs: NonNullable<MddEvidenceDocument['openapi_spec']['supplementary_docs']> = [];
  const notes: string[] = [];
  let swaggerDeps = false;

  for (const spec of specs) {
    const rank = TRUST_RANK[spec.trust_level] ?? 0;
    if (!best || rank > bestRank || (rank === bestRank && spec.found && !best.found)) {
      best = spec;
      bestRank = rank;
    }
    if (spec.swagger_dependencies) swaggerDeps = true;
    if (spec.swagger_related_paths?.length) swaggerRelatedPaths.push(...spec.swagger_related_paths);
    if (spec.supplementary_doc_paths?.length) supplementaryDocPaths.push(...spec.supplementary_doc_paths);
    if (spec.supplementary_docs?.length) supplementaryDocs.push(...spec.supplementary_docs);
    if (spec.notes?.trim()) notes.push(spec.notes.trim());
  }

  const base = best ?? { found: false, path: null, trust_level: 'low' as const };
  return {
    found: specs.some((s) => s.found),
    path: base.path,
    trust_level: base.trust_level,
    ...(swaggerDeps ? { swagger_dependencies: true } : {}),
    ...(swaggerRelatedPaths.length
      ? { swagger_related_paths: uniqStrings(swaggerRelatedPaths) }
      : {}),
    ...(supplementaryDocPaths.length
      ? { supplementary_doc_paths: uniqStrings(supplementaryDocPaths) }
      : {}),
    ...(supplementaryDocs.length ? { supplementary_docs: supplementaryDocs } : {}),
    ...(notes.length ? { notes: uniqStrings(notes).join(' ') } : {}),
  };
}

function mergeInfrastructure(
  rows: MddEvidenceDocument['infrastructure'][],
): MddEvidenceDocument['infrastructure'] {
  const orms = uniqStrings(rows.map((r) => r.orm).filter((o) => o && o !== 'none'));
  const envVars = uniqStrings(rows.flatMap((r) => r.env_vars));
  return {
    orm: orms.length === 0 ? 'none' : orms.length === 1 ? orms[0]! : orms.join(' + '),
    env_vars: envVars,
  };
}

function mergeRiskReport(
  rows: MddEvidenceDocument['risk_report'][],
): MddEvidenceDocument['risk_report'] {
  const complexity = Math.max(0, ...rows.map((r) => r.complexity ?? 0));
  const anti_patterns = uniqStrings(rows.flatMap((r) => r.anti_patterns ?? []));
  return { complexity: Math.min(100, complexity), anti_patterns };
}

function buildMergedSummary(sources: MddMergeSource[]): string {
  const header =
    sources.length === 1
      ? `MDD baseline del repo \`${sources[0]!.slug}\`.`
      : `MDD fusionado multi-root (${sources.length} repos): ${sources.map((s) => `\`${s.slug}\``).join(', ')}.`;
  const parts = sources.map((s) => {
    const excerpt = s.mdd.summary.replace(/\s+/g, ' ').trim().slice(0, 1200);
    return `[${s.slug}] ${excerpt}`;
  });
  return [header, ...parts].join(' ');
}

/** Une varios MDD por repo en uno solo; opcionalmente reemplaza `multi_root` con bloque de proyecto completo. */
export function mergeMddEvidenceDocuments(
  sources: MddMergeSource[],
  multiRoot?: MddMultiRootBlock,
): MddEvidenceDocument {
  if (sources.length === 0) {
    throw new Error('mergeMddEvidenceDocuments requires at least one source');
  }
  if (sources.length === 1) {
    const single = { ...sources[0]!.mdd };
    if (multiRoot) single.multi_root = multiRoot;
    return single;
  }

  const lim = getMddBuilderLimits();
  const mdds = sources.map((s) => s.mdd);

  const merged: MddEvidenceDocument = {
    summary: buildMergedSummary(sources),
    openapi_spec: mergeOpenApiSpec(mdds.map((m) => m.openapi_spec)),
    entities: dedupeEntities(mdds.flatMap((m) => m.entities)),
    api_contracts: dedupeApiContracts(mdds.flatMap((m) => m.api_contracts)),
    business_logic: dedupeBusinessLogic(mdds.flatMap((m) => m.business_logic)),
    infrastructure: mergeInfrastructure(mdds.map((m) => m.infrastructure)),
    risk_report: mergeRiskReport(mdds.map((m) => m.risk_report)),
    evidence_paths: uniqStrings(mdds.flatMap((m) => m.evidence_paths)).slice(0, lim.evidencePaths),
    ...(multiRoot ? { multi_root: multiRoot } : {}),
  };

  return merged;
}
