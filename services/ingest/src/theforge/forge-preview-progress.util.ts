/** Fases persistidas durante preview async de pack Forge. */
export type ForgePreviewPhase =
  | 'pack_merge'
  | 'pack_enrich'
  | 'pack_build'
  | 'done'
  | 'failed';

export type ForgePreviewStatus = 'none' | 'pending' | 'success' | 'failed';

export const FORGE_PREVIEW_PHASE_PERCENT: Record<ForgePreviewPhase, number> = {
  pack_merge: 15,
  pack_enrich: 55,
  pack_build: 40,
  done: 100,
  failed: 0,
};

export const FORGE_PREVIEW_PHASE_LABEL: Record<
  Exclude<ForgePreviewPhase, 'done' | 'failed'>,
  string
> = {
  pack_merge: 'Fusionando chats del lote…',
  pack_enrich: 'Generando tareas Cursor (# Tasks)…',
  pack_build: 'Preparando change pack…',
};

/** 15–50 % según chats fusionados. */
export function forgePreviewMergePercent(completed: number, total: number): number {
  if (total <= 0) return FORGE_PREVIEW_PHASE_PERCENT.pack_merge;
  const ratio = Math.min(1, Math.max(0, completed / total));
  return Math.round(15 + ratio * 35);
}

export function forgePreviewProgressPatch(
  phase: ForgePreviewPhase,
  percent?: number,
): {
  forgePreviewPhase: ForgePreviewPhase;
  forgePreviewPercent: number;
} {
  return {
    forgePreviewPhase: phase,
    forgePreviewPercent: percent ?? FORGE_PREVIEW_PHASE_PERCENT[phase],
  };
}

export function isKnownForgePreviewPhase(value: string | null | undefined): value is ForgePreviewPhase {
  return (
    value === 'pack_merge' ||
    value === 'pack_enrich' ||
    value === 'pack_build' ||
    value === 'done' ||
    value === 'failed'
  );
}
