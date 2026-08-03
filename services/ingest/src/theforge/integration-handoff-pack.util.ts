/**
 * Pack shaping for NEW→LEG integration handoffs (domain-agnostic).
 */
import type { ChangePromotionPackV1, ForgeDeliverableKind } from './change-promotion-pack.types';

/** Default Forge deliverables for integration batches — tasks live in cursor_tasks_markdown. */
export const INTEGRATION_HANDOFF_FORGE_DELIVERABLES: ForgeDeliverableKind[] = ['modification_plan'];

/** Forge deliverables that regenerate from full LEGACY baseline (user stories, login, infra). */
export const FORBIDDEN_INTEGRATION_HANDOFF_DELIVERABLES: ForgeDeliverableKind[] = [
  'migration_tasks',
  'change_spec',
  'data_model',
  'mdd_full',
];

export function normalizeIntegrationHandoffDeliverables(
  input?: ForgeDeliverableKind[],
): ForgeDeliverableKind[] {
  const raw = input?.length ? input : INTEGRATION_HANDOFF_FORGE_DELIVERABLES;
  const forbidden = new Set(FORBIDDEN_INTEGRATION_HANDOFF_DELIVERABLES);
  const filtered = raw.filter((d) => !forbidden.has(d));
  return filtered.length > 0 ? filtered : [...INTEGRATION_HANDOFF_FORGE_DELIVERABLES];
}

export function isIntegrationHandoffPack(pack: ChangePromotionPackV1): boolean {
  return pack.promotionScope === 'integration_handoff';
}

/** Trim legacy MDD for LLM/Forge — baseline context only, not a greenfield backlog. */
export function summarizeMddForIntegrationHandoff(
  pack: ChangePromotionPackV1,
): Record<string, unknown> {
  const mdd = pack.mdd ?? {};
  const paths = pack.modificationPlan.filesToModify.map((f) => f.path);
  return {
    note: 'MDD legacy existente — NO implica backlog greenfield; solo contexto de lo ya implementado',
    summary: typeof mdd.summary === 'string' ? mdd.summary.slice(0, 2000) : undefined,
    stack: mdd.stack ?? mdd.tech_stack,
    pathsInHandoffScope: paths.slice(0, 40),
    endpointCount: Array.isArray(mdd.endpoints) ? mdd.endpoints.length : undefined,
  };
}

export function mddEvidenceForForgePack(pack: ChangePromotionPackV1): Record<string, unknown> {
  return isIntegrationHandoffPack(pack) ? summarizeMddForIntegrationHandoff(pack) : pack.mdd;
}
