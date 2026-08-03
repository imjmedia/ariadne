/**
 * Maps internal ChangePromotionPack v1.1 → The Forge API create-stage body.
 * @see docs/contracts/theforge-create-stage-from-pack-v1.md
 */
import {
  forgeHandoffItemId,
  type ChangePromotionPackV1,
  type CreateStageFromPackInput,
  type ForgeCreateStageApiBody,
  type ForgeChangePackV1,
  type ForgeHandoffItem,
} from './change-promotion-pack.types';

function forgeHandoffItem(
  id: string,
  kind: string,
  title: string,
  content: string,
  options?: { mimeType?: string },
): ForgeHandoffItem {
  return {
    id,
    description: title.slice(0, 4000),
    kind,
    title: title.slice(0, 200),
    content,
    ...(options?.mimeType ? { mimeType: options.mimeType } : {}),
  };
}

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
  let legSequence = 0;
  const nextId = () => forgeHandoffItemId(++legSequence);

  if (pack.mdd && Object.keys(pack.mdd).length > 0) {
    items.push(
      forgeHandoffItem(nextId(), 'mdd_evidence', 'MDD Ariadne (as-is)', JSON.stringify(pack.mdd), {
        mimeType: 'application/json',
      }),
    );
  }

  if (pack.graphEvidenceBundle) {
    items.push(
      forgeHandoffItem(
        nextId(),
        'modification_plan_enriched',
        'Modification plan graph evidence',
        JSON.stringify(pack.graphEvidenceBundle),
        { mimeType: 'application/json' },
      ),
    );
  }

  if (pack.changePlanSeed) {
    items.push(
      forgeHandoffItem(
        nextId(),
        'change_plan_seed',
        'ChangePlan seed (tasks + symbols)',
        JSON.stringify(pack.changePlanSeed),
        { mimeType: 'application/json' },
      ),
    );
  }

  if (pack.changeWorkDescription?.trim()) {
    items.push(
      forgeHandoffItem(
        nextId(),
        'change_work_description',
        'Descripción del trabajo (Ariadne)',
        pack.changeWorkDescription.trim(),
        { mimeType: 'text/markdown' },
      ),
    );
  }

  if (pack.cursorTasksMarkdown?.trim()) {
    items.push(
      forgeHandoffItem(
        nextId(),
        'cursor_tasks_markdown',
        'Tareas Cursor (# Tasks)',
        pack.cursorTasksMarkdown.trim(),
        { mimeType: 'text/markdown' },
      ),
    );
  }

  if (pack.change.erDiagramMermaid?.trim()) {
    items.push(
      forgeHandoffItem(
        nextId(),
        'er_diagram',
        'Diagrama ER',
        pack.change.erDiagramMermaid.trim(),
        { mimeType: 'text/vnd.mermaid' },
      ),
    );
  }

  for (const deliverable of pack.deliverablesRequested) {
    items.push(forgeHandoffItem(nextId(), 'deliverable_request', deliverable, deliverable));
  }

  // P2: Forge must validate migration_tasks against Ariadne Gate 2 after generation.
  if (pack.deliverablesRequested.includes('migration_tasks')) {
    items.push(
      forgeHandoffItem(
        nextId(),
        'post_deliverable_gate',
        'Validate tasksJson via Ariadne Gate 2',
        JSON.stringify({
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
        { mimeType: 'application/json' },
      ),
    );
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
