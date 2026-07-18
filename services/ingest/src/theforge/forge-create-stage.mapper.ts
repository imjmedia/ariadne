/**
 * Maps internal ChangePromotionPack v1.1 → The Forge API create-stage body.
 * @see docs/contracts/theforge-create-stage-from-pack-v1.md
 */
import type {
  ChangePromotionPackV1,
  CreateStageFromPackInput,
  ForgeCreateStageApiBody,
  ForgeChangePackV1,
  ForgeHandoffItem,
} from './change-promotion-pack.types';

export function buildForgeChangeDescription(pack: ChangePromotionPackV1): string {
  const parts: string[] = [pack.change.userDescription.trim()];
  if (pack.change.decisions.length > 0) {
    parts.push(
      '\n\n## Decisiones\n' + pack.change.decisions.map((d) => `- ${d}`).join('\n'),
    );
  }
  if (pack.change.migrationNotes?.trim()) {
    parts.push('\n\n## Notas de migración\n' + pack.change.migrationNotes.trim());
  }
  if (pack.change.erDiagramMermaid?.trim()) {
    parts.push(
      '\n\n## ERD (Mermaid)\n```mermaid\n' + pack.change.erDiagramMermaid.trim() + '\n```',
    );
  }
  return parts.join('').slice(0, 12_000);
}

export function buildForgeHandoffItems(pack: ChangePromotionPackV1): ForgeHandoffItem[] {
  const items: ForgeHandoffItem[] = [];

  if (pack.mdd && Object.keys(pack.mdd).length > 0) {
    items.push({
      kind: 'mdd_evidence',
      title: 'MDD Ariadne (as-is)',
      content: JSON.stringify(pack.mdd),
      mimeType: 'application/json',
    });
  }

  if (pack.change.erDiagramMermaid?.trim()) {
    items.push({
      kind: 'er_diagram',
      title: 'Diagrama ER',
      content: pack.change.erDiagramMermaid.trim(),
      mimeType: 'text/vnd.mermaid',
    });
  }

  for (const deliverable of pack.deliverablesRequested) {
    items.push({
      kind: 'deliverable_request',
      title: deliverable,
      content: deliverable,
    });
  }

  return items;
}

export function toForgeChangePackV1(pack: ChangePromotionPackV1): ForgeChangePackV1 {
  return {
    version: '1',
    changeDescription: buildForgeChangeDescription(pack),
    ariadneChangeId: pack.change.stageKey,
    ariadneRepositoryId: pack.ariadne.repositoryId ?? undefined,
    ariadneProjectId: pack.ariadne.projectId,
    ariadneConversationId: pack.ariadne.conversationId,
    idempotencyKey: pack.idempotencyKey,
    filesToModify: pack.modificationPlan.filesToModify.map((f) => ({
      path: f.path,
      ...(f.repoId ? { repoId: f.repoId } : {}),
    })),
    ...(pack.modificationPlan.questionsToRefine?.length
      ? { questionsToRefine: pack.modificationPlan.questionsToRefine }
      : {}),
    handoffItems: buildForgeHandoffItems(pack),
  };
}

export function toForgeCreateStageApiBody(input: CreateStageFromPackInput): ForgeCreateStageApiBody {
  const filesCount = input.pack.modificationPlan.filesToModify.length;
  return {
    forgeProjectId: input.forgeProjectId,
    pack: toForgeChangePackV1(input.pack),
    stageName: input.stageName ?? input.pack.change.title,
    ...(input.stageId ? { stageId: input.stageId } : {}),
    activate: input.activate ?? false,
    runLegacyStart: input.runLegacyStart ?? filesCount === 0,
    wireAriadne: input.wireAriadne ?? true,
  };
}
