/** Etiquetas de fase promote → Forge (mirror backend forge-promotion-progress.util). */
export type ForgePromotionPhase =
  | 'pack_resolve'
  | 'pack_enrich'
  | 'forge_create'
  | 'done'
  | 'failed';

export const FORGE_PROMOTION_PHASE_LABEL: Record<
  Exclude<ForgePromotionPhase, 'done' | 'failed'>,
  string
> = {
  pack_resolve: 'Preparando change pack…',
  pack_enrich: 'Generando tareas Cursor (# Tasks)…',
  forge_create: 'Creando etapa en The Forge…',
};

export function isKnownForgePromotionPhase(
  value: string | null | undefined,
): value is ForgePromotionPhase {
  return (
    value === 'pack_resolve' ||
    value === 'pack_enrich' ||
    value === 'forge_create' ||
    value === 'done' ||
    value === 'failed'
  );
}
