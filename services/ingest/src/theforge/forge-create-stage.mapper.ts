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

  if (pack.graphEvidenceBundle) {
    items.push({
      kind: 'modification_plan_enriched',
      title: 'Modification plan graph evidence',
      content: JSON.stringify(pack.graphEvidenceBundle),
      mimeType: 'application/json',
    });
  }

  if (pack.changePlanSeed) {
    items.push({
      kind: 'change_plan_seed',
      title: 'ChangePlan seed (tasks + symbols)',
      content: JSON.stringify(pack.changePlanSeed),
      mimeType: 'application/json',
    });
  }

  if (pack.changeWorkDescription?.trim()) {
    items.push({
      kind: 'change_work_description',
      title: 'Descripción del trabajo (Ariadne)',
      content: pack.changeWorkDescription.trim(),
      mimeType: 'text/markdown',
    });
  }

  if (pack.cursorTasksMarkdown?.trim()) {
    items.push({
      kind: 'cursor_tasks_markdown',
      title: 'Tareas Cursor (# Tasks)',
      content: pack.cursorTasksMarkdown.trim(),
      mimeType: 'text/markdown',
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

  // P2: Forge must validate migration_tasks against Ariadne Gate 2 after generation.
  if (pack.deliverablesRequested.includes('migration_tasks')) {
    items.push({
      kind: 'post_deliverable_gate',
      title: 'Validate tasksJson via Ariadne Gate 2',
      content: JSON.stringify({
        required: true,
        blockOnVerdict: 'BLOCKED',
        endpoint: `/projects/${pack.ariadne.projectId}/validate-tasks-json`,
        method: 'POST',
        bodyHint: {
          tasksJson: '<Forge tasksJson v2 after legacy_generate_deliverables>',
          changeDescription: pack.change.userDescription.slice(0, 500),
        },
        mcpTool: 'validate_change_plan',
        note: 'After legacy_generate_deliverables, POST tasksJson to Ariadne. If verdict===BLOCKED, do not mark migration_tasks complete.',
      }),
      mimeType: 'application/json',
    });
  }

  return items;
}

/** Default tools after create-stage — includes Ariadne Gate 2 after deliverables. */
export function defaultRecommendedNextTools(pack: ChangePromotionPackV1): string[] {
  const tools = ['legacy_answer', 'legacy_generate_mdd', 'legacy_generate_deliverables'];
  if (pack.deliverablesRequested.includes('migration_tasks')) {
    tools.push('validate_change_plan_via_ariadne');
  }
  return tools;
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
  const forgePack = toForgeChangePackV1(input.pack);
  if (input.linkedNewProjectId?.trim()) {
    forgePack.linkedNewProjectId = input.linkedNewProjectId.trim();
  }
  return {
    forgeProjectId: input.forgeProjectId,
    pack: forgePack,
    stageName: input.stageName ?? input.pack.change.title,
    ...(input.stageId ? { stageId: input.stageId } : {}),
    activate: input.activate ?? false,
    runLegacyStart: input.runLegacyStart ?? filesCount === 0,
    wireAriadne: input.wireAriadne ?? true,
  };
}
