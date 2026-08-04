/**
 * Build Forge tasksJson v2 seed from Ariadne ChangePromotionPack (inverse of forge-tasks-json.mapper).
 * Consumed by The Forge on create-stage to hydrate the native Tasks panel without migration_tasks cascade.
 */
import type { ChangePlanTask } from '../plan-validation/change-plan-validation.types';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';
import { isIntegrationHandoffPack } from './integration-handoff-pack.util';
import { parseCursorTasksMarkdownToSeed } from './parse-cursor-tasks-markdown.util';

export const FORGE_TASKS_JSON_SCHEMA_VERSION = '2' as const;

export interface ForgeTasksJsonSeedTask {
  id: string;
  title: string;
  files: string[];
  symbols?: string[];
  endpoints?: string[];
  phase?: string;
  criterion?: string;
  evidence?: Array<{ kind: string; ref: string }>;
  dependsOn?: string[];
  status?: 'pending' | 'in_progress' | 'done';
  source?: 'ariadne_change_plan_seed' | 'ariadne_modification_plan' | 'ariadne_cursor_tasks_markdown';
  /** Business handoff ref (e.g. NEW-LEG-01) when derived from cursor markdown. */
  storyRef?: string;
}

export interface ForgeTasksJsonSeedV2 {
  schemaVersion: typeof FORGE_TASKS_JSON_SCHEMA_VERSION;
  source: 'ariadne';
  projectId: string;
  changeDescription: string;
  ariadneChangeId: string;
  promotionScope?: ChangePromotionPackV1['promotionScope'];
  tasks: ForgeTasksJsonSeedTask[];
  files: Array<{ path: string; repoId?: string }>;
}

function mapSeedTask(task: ChangePlanTask, index: number): ForgeTasksJsonSeedTask | null {
  const files = task.files.map((p) => p.replace(/\\/g, '/')).filter(Boolean);
  if (files.length === 0) return null;
  return {
    id: task.id ?? `T-${String(index + 1).padStart(3, '0')}`,
    title: task.title,
    files,
    ...(task.symbols?.length ? { symbols: task.symbols } : {}),
    ...(task.endpoints?.length ? { endpoints: task.endpoints } : {}),
    ...(task.phase ? { phase: task.phase } : {}),
    ...(task.criterion ? { criterion: task.criterion } : {}),
    ...(task.evidence?.length
      ? { evidence: task.evidence.map((e) => ({ kind: e.kind, ref: e.ref })) }
      : {}),
    ...(task.dependsOn?.length ? { dependsOn: task.dependsOn } : {}),
    status: 'pending',
    source: 'ariadne_change_plan_seed',
  };
}

function tasksFromModificationPlan(pack: ChangePromotionPackV1): ForgeTasksJsonSeedTask[] {
  return pack.modificationPlan.filesToModify.slice(0, 40).map((f, i) => ({
    id: `T-${String(i + 1).padStart(3, '0')}`,
    title: `Modificar ${f.path.split('/').pop() ?? f.path}`,
    files: [f.path.replace(/\\/g, '/')],
    phase: '1-core',
    criterion: 'Aplicar cambio según plan Ariadne',
    status: 'pending' as const,
    source: 'ariadne_modification_plan' as const,
  }));
}

/** Whether the pack should carry a structured tasksJson seed for Forge hydration. */
export function shouldIncludeForgeTasksJsonSeed(pack: ChangePromotionPackV1): boolean {
  if (pack.changePlanSeed?.tasks?.length) return true;
  if (pack.cursorTasksMarkdown?.trim()) return true;
  if (isIntegrationHandoffPack(pack) && pack.modificationPlan.filesToModify.length > 0) return true;
  return false;
}

function enrichTasksWithGraphEvidence(
  tasks: ForgeTasksJsonSeedTask[],
  seedTasks: ChangePlanTask[],
): ForgeTasksJsonSeedTask[] {
  if (!seedTasks.length) return tasks;
  const byFile = new Map<string, ChangePlanTask>();
  for (const t of seedTasks) {
    for (const f of t.files) {
      byFile.set(f.replace(/\\/g, '/'), t);
    }
  }
  return tasks.map((task) => {
    const graph = task.files.map((f) => byFile.get(f)).find(Boolean);
    if (!graph) return task;
    return {
      ...task,
      ...(graph.symbols?.length && !task.symbols?.length ? { symbols: graph.symbols } : {}),
      ...(graph.evidence?.length && !task.evidence?.length
        ? { evidence: graph.evidence.map((e) => ({ kind: e.kind, ref: e.ref })) }
        : {}),
      ...(graph.criterion && !task.criterion ? { criterion: graph.criterion } : {}),
    };
  });
}

/** Build Forge tasksJson v2 seed; null when no tasks/files can be derived. */
export function buildForgeTasksJsonSeed(
  pack: ChangePromotionPackV1,
): ForgeTasksJsonSeedV2 | null {
  if (!shouldIncludeForgeTasksJsonSeed(pack)) return null;

  const meta = {
    projectId: pack.ariadne.projectId,
    changeDescription: pack.change.userDescription.trim(),
    ariadneChangeId: pack.change.stageKey,
    promotionScope: pack.promotionScope,
  };

  const cursorMd = pack.cursorTasksMarkdown?.trim();
  if (cursorMd) {
    const parsed = parseCursorTasksMarkdownToSeed(cursorMd, meta);
    if (parsed.ok) {
      const seedTasks = pack.changePlanSeed?.tasks ?? [];
      return {
        ...parsed.seed,
        tasks: enrichTasksWithGraphEvidence(parsed.seed.tasks, seedTasks),
      };
    }
  }

  const seedTasks = pack.changePlanSeed?.tasks ?? [];
  const mapped =
    seedTasks.length > 0
      ? seedTasks
          .map((t, i) => mapSeedTask(t, i))
          .filter((t): t is ForgeTasksJsonSeedTask => t != null)
      : tasksFromModificationPlan(pack);

  if (mapped.length === 0) return null;

  const fileMap = new Map<string, { path: string; repoId?: string }>();
  for (const t of mapped) {
    for (const path of t.files) {
      const key = path.replace(/\\/g, '/');
      if (!fileMap.has(key)) {
        const planFile = pack.modificationPlan.filesToModify.find(
          (f) => f.path.replace(/\\/g, '/') === key,
        );
        fileMap.set(key, { path: key, ...(planFile?.repoId ? { repoId: planFile.repoId } : {}) });
      }
    }
  }

  return {
    schemaVersion: FORGE_TASKS_JSON_SCHEMA_VERSION,
    source: 'ariadne',
    projectId: pack.ariadne.projectId,
    changeDescription: pack.change.userDescription.trim().slice(0, 2000),
    ariadneChangeId: pack.change.stageKey,
    ...(pack.promotionScope ? { promotionScope: pack.promotionScope } : {}),
    tasks: mapped,
    files: [...fileMap.values()],
  };
}
