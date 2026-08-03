/** Etiquetas de fase preview pack Forge (mirror backend forge-preview-progress.util). */
export type ForgePreviewPhase =
  | 'pack_merge'
  | 'pack_enrich'
  | 'pack_build'
  | 'done'
  | 'failed';

export type ForgePreviewStatus = 'none' | 'pending' | 'success' | 'failed';

export const FORGE_PREVIEW_PHASE_LABEL: Record<
  Exclude<ForgePreviewPhase, 'done' | 'failed'>,
  string
> = {
  pack_merge: 'Fusionando chats del lote…',
  pack_enrich: 'Generando tareas Cursor (# Tasks)…',
  pack_build: 'Preparando change pack…',
};

export function isKnownForgePreviewPhase(
  value: string | null | undefined,
): value is ForgePreviewPhase {
  return (
    value === 'pack_merge' ||
    value === 'pack_enrich' ||
    value === 'pack_build' ||
    value === 'done' ||
    value === 'failed'
  );
}

export function forgePreviewPhaseLabel(phase: string | null | undefined): string {
  if (phase && isKnownForgePreviewPhase(phase) && phase !== 'done' && phase !== 'failed') {
    return FORGE_PREVIEW_PHASE_LABEL[phase];
  }
  return FORGE_PREVIEW_PHASE_LABEL.pack_build;
}
