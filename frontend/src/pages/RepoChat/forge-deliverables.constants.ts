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

/** Lotes NEW→LEG: re-export desde forge-ariadne-artifacts.constants.ts */
export {
  INTEGRATION_BATCH_FORGE_DELIVERABLES,
  INTEGRATION_BATCH_FORGE_OPTIONAL_DELIVERABLES,
  forgeDeliverablesEqual,
} from './forge-ariadne-artifacts.constants';
