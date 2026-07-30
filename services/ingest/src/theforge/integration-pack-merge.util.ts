/**
 * Merge multiple ChangePromotionPack v1.1 into one batch pack for a single Forge stage.
 */
import { createHash } from 'crypto';
import type { GraphEvidenceBundle } from '../chat/modification-plan-evidence.types';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';
import { slugifyStageKey } from './change-promotion-pack.types';

function dedupeFiles(files: ChangePromotionPackV1['modificationPlan']['filesToModify']) {
  const seen = new Set<string>();
  const out: ChangePromotionPackV1['modificationPlan']['filesToModify'] = [];
  for (const file of files) {
    const key = `${file.repoId ?? ''}:${file.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}

function mergeGraphBundles(packs: ChangePromotionPackV1[]): GraphEvidenceBundle | undefined {
  const bundles = packs.map((p) => p.graphEvidenceBundle).filter(Boolean) as GraphEvidenceBundle[];
  if (bundles.length === 0) return undefined;
  const fileMap = new Map<string, GraphEvidenceBundle['files'][number]>();
  for (const bundle of bundles) {
    for (const file of bundle.files) {
      fileMap.set(`${file.repoId}:${file.path}`, file);
    }
  }
  return {
    ...bundles[0],
    generatedAt: new Date().toISOString(),
    files: [...fileMap.values()],
  };
}

function mergeDecisions(packs: ChangePromotionPackV1[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const pack of packs) {
    for (const decision of pack.change.decisions) {
      const key = decision.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(decision);
    }
  }
  return out;
}

function mergeUserDescription(packs: ChangePromotionPackV1[]): string {
  return packs
    .map((pack, index) => {
      const label =
        pack.ariadne.conversationTitle?.trim() ||
        pack.change.title?.trim() ||
        `Cambio ${index + 1}`;
      return `### ${label}\n\n${pack.change.userDescription.trim()}`;
    })
    .join('\n\n---\n\n');
}

function mergeMermaid(packs: ChangePromotionPackV1[]): string | null {
  const blocks = packs
    .map((p) => p.change.erDiagramMermaid?.trim())
    .filter((b): b is string => Boolean(b));
  if (blocks.length === 0) return null;
  if (blocks.length === 1) return blocks[0];
  return blocks.join('\n\n');
}

function mergeMigrationNotes(packs: ChangePromotionPackV1[]): string | null {
  const notes = packs
    .map((p) => p.change.migrationNotes?.trim())
    .filter((n): n is string => Boolean(n));
  if (notes.length === 0) return null;
  return notes.join('\n\n');
}

export function mergeChangePromotionPacks(input: {
  packs: ChangePromotionPackV1[];
  stageName: string;
  stageKey?: string;
  batchId: string;
}): ChangePromotionPackV1 {
  const { packs, stageName, batchId } = input;
  if (packs.length === 0) {
    throw new Error('mergeChangePromotionPacks requires at least one pack');
  }

  const base = packs[0];
  const stageKey = (input.stageKey?.trim() || slugifyStageKey(stageName)).slice(0, 48);
  const filesToModify = dedupeFiles(packs.flatMap((p) => p.modificationPlan.filesToModify));
  const userDescription = mergeUserDescription(packs);
  const idempotencyKey = createHash('sha256')
    .update(`batch:${batchId}:${stageKey}:${base.ariadne.commitSha ?? ''}`)
    .digest('hex')
    .slice(0, 32);

  const graphEvidenceBundle = mergeGraphBundles(packs);
  const seeds = packs.map((p) => p.changePlanSeed).filter(Boolean);
  const taskMap = new Map<string, NonNullable<NonNullable<ChangePromotionPackV1['changePlanSeed']>['tasks']>[number]>();
  for (const seed of seeds) {
    for (const task of seed!.tasks ?? []) {
      if (!task.id) continue;
      taskMap.set(task.id, task);
    }
  }
  const changePlanSeed =
    seeds.length > 0
      ? {
          ...seeds[0]!,
          tasks: [...taskMap.values()],
        }
      : undefined;

  return {
    ...base,
    idempotencyKey,
    generatedAt: new Date().toISOString(),
    ariadne: {
      ...base.ariadne,
      /** Forge contract expects a UUID; batch.id is the stable id for merged lotes. */
      conversationId: batchId,
      conversationTitle: stageName,
    },
    change: {
      title: stageName.trim(),
      stageKey,
      userDescription,
      decisions: mergeDecisions(packs),
      erDiagramMermaid: mergeMermaid(packs),
      migrationNotes: mergeMigrationNotes(packs),
    },
    modificationPlan: {
      ...base.modificationPlan,
      filesToModify,
      questionsToRefine: [
        ...new Set(packs.flatMap((p) => p.modificationPlan.questionsToRefine ?? [])),
      ],
    },
    graphEvidenceBundle,
    changePlanSeed,
    deliverablesRequested: base.deliverablesRequested,
  };
}
