/** Fases persistidas durante promote async → The Forge. */
export type ForgePromotionPhase =
  | 'pack_resolve'
  | 'pack_enrich'
  | 'forge_create'
  | 'done'
  | 'failed';

export const FORGE_PROMOTION_PHASE_PERCENT: Record<ForgePromotionPhase, number> = {
  pack_resolve: 15,
  pack_enrich: 35,
  forge_create: 95,
  done: 100,
  failed: 0,
};

export const FORGE_PROMOTION_PHASE_LABEL: Record<
  Exclude<ForgePromotionPhase, 'done' | 'failed'>,
  string
> = {
  pack_resolve: 'Preparando change pack…',
  pack_enrich: 'Generando tareas Cursor (# Tasks)…',
  forge_create: 'Creando etapa en The Forge…',
};

export function forgePromotionProgressPatch(
  phase: ForgePromotionPhase,
): { forgePromotionPhase: ForgePromotionPhase; forgePromotionPercent: number } {
  return {
    forgePromotionPhase: phase,
    forgePromotionPercent: FORGE_PROMOTION_PHASE_PERCENT[phase],
  };
}

export function isKnownForgePromotionPhase(value: string | null | undefined): value is ForgePromotionPhase {
  return (
    value === 'pack_resolve' ||
    value === 'pack_enrich' ||
    value === 'forge_create' ||
    value === 'done' ||
    value === 'failed'
  );
}
