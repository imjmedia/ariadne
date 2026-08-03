import type { ForgeDeliverableKind } from '@/types';

export const FORGE_DELIVERABLE_OPTIONS: { id: ForgeDeliverableKind; label: string }[] = [
  { id: 'change_spec', label: 'Especificación del cambio' },
  { id: 'data_model', label: 'Modelo de datos (ERD)' },
  { id: 'modification_plan', label: 'Plan de modificación' },
  { id: 'migration_tasks', label: 'Tareas de migración' },
  { id: 'api_contracts', label: 'Contratos API' },
  { id: 'mdd_full', label: 'MDD completo' },
];

export const ALL_FORGE_DELIVERABLES: ForgeDeliverableKind[] = FORGE_DELIVERABLE_OPTIONS.map(
  (opt) => opt.id,
);

/** Lotes NEW→LEG: no pedir migration_tasks (Forge regenera US baseline); tareas en cursor_tasks_markdown. */
export const INTEGRATION_BATCH_FORGE_DELIVERABLES: ForgeDeliverableKind[] = [
  'modification_plan',
  'api_contracts',
];

export function forgeDeliverablesEqual(
  a: ForgeDeliverableKind[],
  b: ForgeDeliverableKind[],
): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}
