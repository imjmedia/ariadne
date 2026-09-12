/**
 * Parches mínimos Archify showcase aplicados en ingest (antes del sanitize de ariadne-common).
 * Cubre: labels org/repo demasiado anchos y mensajes sequence from===to (0px span).
 */
import type { ArchifyArchitectureIr, ArchifySequenceIr } from 'ariadne-common';

const ARCHIFY_MIN_COMPONENT_W = 130;
const ARCHIFY_LABEL_FACTOR = 6.6;
const ARCHIFY_LABEL_PAD = 8;

function labelWidthPx(label: string): number {
  return label.length * ARCHIFY_LABEL_FACTOR;
}

function minWidthForLabel(label: string): number {
  return Math.ceil(labelWidthPx(label) - ARCHIFY_LABEL_PAD);
}

/** Acorta `org/repo` → `repo` y ensancha size si hace falta. */
export function fixArchifyArchitectureIr(ir: ArchifyArchitectureIr): ArchifyArchitectureIr {
  const components = (ir.components ?? []).map((c) => {
    let label = c.label?.trim() || 'Component';
    let sublabel = c.sublabel?.trim() || undefined;
    const slash = label.lastIndexOf('/');
    if (slash > 0 && slash < label.length - 1) {
      const full = label;
      label = full.slice(slash + 1).trim() || label;
      sublabel = sublabel && sublabel !== full
        ? `${full} · ${sublabel}`.slice(0, 120)
        : full.slice(0, 120);
    }
    const baseW = Array.isArray(c.size) ? c.size[0]! : ARCHIFY_MIN_COMPONENT_W;
    const baseH = Array.isArray(c.size) ? c.size[1]! : 60;
    const width = Math.max(baseW, ARCHIFY_MIN_COMPONENT_W, minWidthForLabel(label));
    return {
      ...c,
      label,
      ...(sublabel ? { sublabel } : {}),
      size: [width, baseH] as [number, number],
    };
  });
  return { ...ir, components };
}

/** Elimina self-loops (web→web) que Archify rechaza (<60px span). */
export function fixArchifySequenceIr(ir: ArchifySequenceIr): ArchifySequenceIr {
  const messages = (ir.messages ?? []).filter((m) => m.from !== m.to);
  return { ...ir, messages };
}
