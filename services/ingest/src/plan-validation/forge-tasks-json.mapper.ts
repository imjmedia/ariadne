/**
 * Map Forge tasksJson / tasksContent-shaped payloads → Ariadne ChangePlan for Gate 2.
 */
import {
  CHANGE_PLAN_SCHEMA_VERSION,
  type ChangePlan,
  type ChangePlanFile,
  type ChangePlanTask,
  type ChangePlanTaskEvidence,
} from './change-plan-validation.types';

export interface ForgeTasksJsonV2 {
  schemaVersion?: string;
  tasks?: unknown[];
  files?: unknown[];
  changeDescription?: string;
  projectId?: string;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asString(x)).filter((x): x is string => Boolean(x));
}

function mapEvidence(raw: unknown): ChangePlanTaskEvidence[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ChangePlanTaskEvidence[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    if (!o) continue;
    const kind = asString(o.kind);
    const ref = asString(o.ref) ?? asString(o.value) ?? asString(o.path);
    if (
      kind &&
      ref &&
      (kind === 'path' || kind === 'symbol' || kind === 'endpoint' || kind === 'prop')
    ) {
      out.push({ kind, ref });
    }
  }
  return out.length ? out : undefined;
}

function mapTask(raw: unknown, index: number): ChangePlanTask | null {
  const o = asRecord(raw);
  if (!o) return null;
  const title = asString(o.title) ?? asString(o.name) ?? `Task ${index + 1}`;
  const files = asStringArray(o.files ?? o.archivos ?? o.paths);
  if (files.length === 0) {
    const single = asString(o.file) ?? asString(o.path) ?? asString(o.archivo);
    if (single) files.push(single);
  }
  if (files.length === 0) return null;
  return {
    id: asString(o.id) ?? `T${index + 1}`,
    title,
    files,
    symbols: asStringArray(o.symbols),
    endpoints: asStringArray(o.endpoints),
    phase: asString(o.phase) ?? asString(o.fase),
    criterion: asString(o.criterion) ?? asString(o.criterio) ?? asString(o.acceptanceCriteria),
    evidence: mapEvidence(o.evidence),
    dependsOn: asStringArray(o.dependsOn ?? o.depends_on),
  };
}

/**
 * Build a ChangePlan from Forge tasksJson (v2) or a loose tasks array.
 * Files are union of task.files (and optional top-level files).
 */
export function changePlanFromForgeTasksJson(
  projectId: string,
  raw: unknown,
  opts?: { changeDescription?: string; source?: ChangePlan['source'] },
): ChangePlan {
  const root = asRecord(raw) ?? {};
  const tasksRaw = Array.isArray(raw)
    ? raw
    : Array.isArray(root.tasks)
      ? root.tasks
      : Array.isArray((root as ForgeTasksJsonV2).tasks)
        ? (root as ForgeTasksJsonV2).tasks!
        : [];

  const tasks = tasksRaw
    .map((t, i) => mapTask(t, i))
    .filter((t): t is ChangePlanTask => t != null);

  const fileMap = new Map<string, ChangePlanFile>();
  for (const t of tasks) {
    for (const path of t.files) {
      const key = path.replace(/\\/g, '/');
      if (!fileMap.has(key)) {
        fileMap.set(key, {
          path: key,
          changeType: 'modify',
          symbols: t.symbols?.slice(0, 8),
        });
      } else {
        const existing = fileMap.get(key)!;
        const merged = new Set([...(existing.symbols ?? []), ...(t.symbols ?? [])]);
        existing.symbols = [...merged].slice(0, 8);
      }
    }
  }

  const topFiles = Array.isArray(root.files) ? root.files : [];
  for (const f of topFiles) {
    const o = asRecord(f);
    const path = asString(o?.path) ?? asString(f);
    if (!path) continue;
    const key = path.replace(/\\/g, '/');
    if (!fileMap.has(key)) {
      fileMap.set(key, {
        path: key,
        changeType: 'modify',
        symbols: asStringArray(o?.symbols),
        repoId: asString(o?.repoId),
      });
    }
  }

  const files = [...fileMap.values()];
  if (files.length === 0) {
    throw new Error('Forge tasksJson produced no files — cannot validate');
  }

  return {
    schemaVersion: CHANGE_PLAN_SCHEMA_VERSION,
    projectId: asString(root.projectId) ?? projectId,
    source: opts?.source ?? 'theforge',
    changeDescription:
      opts?.changeDescription ?? asString(root.changeDescription) ?? 'Forge migration_tasks validation',
    files,
    tasks,
  };
}
