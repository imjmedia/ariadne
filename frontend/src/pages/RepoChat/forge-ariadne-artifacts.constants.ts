import type { ForgeDeliverableKind } from '@/types';

/** Documentos que Ariadne genera y envía a The Forge (no entregables legacy). */
export const ARIADNE_FORGE_ARTIFACT_LABELS: { id: string; label: string; hint?: string }[] = [
  { id: 'change_work_description', label: 'Descripción del trabajo', hint: 'Markdown completo del cambio' },
  { id: 'cursor_tasks_markdown', label: 'Tareas Cursor (# Tasks)', hint: 'YAML + checklist por archivo' },
  { id: 'tasks_json_seed', label: 'Tasks JSON (SSOT)', hint: 'Panel Tasks en Forge' },
  { id: 'change_plan_seed', label: 'ChangePlan (Gate 2)', hint: 'Tareas con símbolos y evidencia' },
  { id: 'modification_plan_enriched', label: 'Plan de modificación (grafo)', hint: 'Evidencia por archivo' },
  { id: 'mdd_evidence', label: 'MDD / contexto legacy', hint: 'Resumen as-is indexado' },
  { id: 'integration_scope', label: 'Alcance integración', hint: 'Metadatos NEW→LEG' },
];

/** Entregables Forge opcionales en lotes de integración (no regenerar baseline). */
export const INTEGRATION_BATCH_FORGE_OPTIONAL_DELIVERABLES: {
  id: ForgeDeliverableKind;
  label: string;
}[] = [
  { id: 'modification_plan', label: 'Plan de modificación (Forge)' },
  { id: 'api_contracts', label: 'Contratos API (Forge)' },
];

/** Defaults al abrir modal de lote NEW→LEG. */
export const INTEGRATION_BATCH_FORGE_DELIVERABLES: ForgeDeliverableKind[] =
  INTEGRATION_BATCH_FORGE_OPTIONAL_DELIVERABLES.map((o) => o.id);

export function forgeDeliverablesEqual(
  a: ForgeDeliverableKind[],
  b: ForgeDeliverableKind[],
): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}
