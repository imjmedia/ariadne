/**
 * Maps internal ChangePromotionPack v1.1 → The Forge API create-stage body.
 * @see docs/contracts/theforge-create-stage-from-pack-v1.md
 */
import {
  forgeHandoffItemId,
  FORGE_CHANGE_DESCRIPTION_MAX,
  type ChangePromotionPackV1,
  type CreateStageFromPackInput,
  type ForgeCreateStageApiBody,
  type ForgeChangePackV1,
  type ForgeHandoffItem,
} from './change-promotion-pack.types';
import {
  isIntegrationHandoffPack,
  mddEvidenceForForgePack,
} from './integration-handoff-pack.util';
import { buildForgeTasksJsonSeed } from './forge-tasks-json-seed.util';

function forgeHandoffItem(
  id: string,
  kind: string,
  title: string,
  content: string,
  options?: { mimeType?: string },
): ForgeHandoffItem {
  const body = content.trim();
  const isJson = body.startsWith('{') || body.startsWith('[');
  let payload: unknown | undefined;
  if (isJson) {
    try {
      payload = JSON.parse(body) as unknown;
    } catch {
      payload = undefined;
    }
  }
  return {
    id,
    description: body.slice(0, 200_000),
    kind,
    title: title.slice(0, 200),
    content: body,
    ...(payload !== undefined ? { payload } : {}),
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
  return parts.join('').slice(0, FORGE_CHANGE_DESCRIPTION_MAX);
}

export function buildForgeHandoffItems(pack: ChangePromotionPackV1): ForgeHandoffItem[] {
  const items: ForgeHandoffItem[] = [];
  let legSequence = 0;
  const nextId = () => forgeHandoffItemId(++legSequence);

  if (isIntegrationHandoffPack(pack)) {
    items.push(
      forgeHandoffItem(
        nextId(),
        'integration_scope',
        'Alcance integración NEW→LEG',
        JSON.stringify({
          mode: 'integration_handoff',
          stageOrigin: 'ariadne_integration_handoff',
          taskSource: 'cursor_tasks_markdown',
          taskSourceFallback: 'tasks_json_seed',
          taskSourceGraph: 'change_plan_seed',
          skipBaselineDeliverables: [
            'migration_tasks',
            'change_spec',
            'data_model',
            'mdd_full',
          ],
          linkedNewProjectId: pack.integrationHandoff?.sourceProject ?? undefined,
          acceptanceCriteria: pack.integrationHandoff?.acceptanceCriteria ?? [],
        }),
        { mimeType: 'application/json' },
      ),
    );
  }

  const mddEvidence = mddEvidenceForForgePack(pack);
  if (mddEvidence && Object.keys(mddEvidence).length > 0) {
    items.push(
      forgeHandoffItem(
        nextId(),
        'mdd_evidence',
        isIntegrationHandoffPack(pack) ? 'MDD legacy (resumen alcance)' : 'MDD Ariadne (as-is)',
        JSON.stringify(mddEvidence),
        { mimeType: 'application/json' },
      ),
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

  const tasksJsonSeed = buildForgeTasksJsonSeed(pack);
  if (tasksJsonSeed) {
    items.push(
      forgeHandoffItem(
        nextId(),
        'tasks_json_seed',
        'Tasks JSON seed (Ariadne SSOT)',
        JSON.stringify(tasksJsonSeed),
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
    if (
      isIntegrationHandoffPack(pack) &&
      (deliverable === 'migration_tasks' ||
        deliverable === 'change_spec' ||
        deliverable === 'data_model' ||
        deliverable === 'mdd_full')
    ) {
      continue;
    }
    items.push(forgeHandoffItem(nextId(), 'deliverable_request', deliverable, deliverable));
  }

  // P2: Forge must validate migration_tasks against Ariadne Gate 2 after generation.
  if (
    pack.deliverablesRequested.includes('migration_tasks') &&
    !isIntegrationHandoffPack(pack)
  ) {
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
  if (isIntegrationHandoffPack(pack)) {
    return ['get_tasks_json', 'get_next_implementation_task', 'legacy_answer'];
  }
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
