import type { ArchifyArchitectureIr } from './to-archify.mapper.js';
import type { ArchifySequenceIr } from './to-archify-sequence.js';

const CELL_W = 130;
const CELL_H = 60;
const GAP_X = 80;
const GAP_Y = 100;
const MARGIN_X = 40;
const MARGIN_Y = 80;

type LegacyArchitectureComponent = ArchifyArchitectureIr['components'][number] & {
  row?: number;
  col?: number;
};

type ArchifyConnection = NonNullable<ArchifyArchitectureIr['connections']>[number];

type LegacyArchitectureIr = Omit<ArchifyArchitectureIr, 'components' | 'meta' | 'connections'> & {
  layout?: { cols?: number };
  meta?: ArchifyArchitectureIr['meta'] & { quality_profile?: string };
  components?: LegacyArchitectureComponent[];
  connections?: Array<ArchifyConnection & { id?: string }>;
};

/** Elimina campos legacy (pre v2.9) y normaliza al schema Archify actual. */
export function sanitizeArchifyArchitectureIr(ir: LegacyArchitectureIr): ArchifyArchitectureIr {
  const cols =
    ir.layout?.cols ??
    Math.min(4, Math.max(2, Math.ceil(Math.sqrt((ir.components?.length ?? 1) + 1))));

  const components = (ir.components ?? []).map((c, index) => {
    const row = c.row ?? Math.floor(index / cols);
    const col = c.col ?? index % cols;
    const pos: [number, number] =
      Array.isArray(c.pos) && c.pos.length === 2
        ? [c.pos[0]!, c.pos[1]!]
        : [MARGIN_X + col * (CELL_W + GAP_X), MARGIN_Y + row * (CELL_H + GAP_Y)];
    const size: [number, number] =
      Array.isArray(c.size) && c.size.length === 2 ? [c.size[0]!, c.size[1]!] : [CELL_W, CELL_H];
    return {
      id: c.id,
      type: c.type,
      label: c.label,
      sublabel: c.sublabel,
      tag: c.tag,
      pos,
      size,
    };
  });

  const connections: ArchifyConnection[] = (ir.connections ?? []).map((conn) => {
    const { id: _id, ...rest } = conn;
    return rest;
  });

  const { quality_profile: _qp, ...meta } = ir.meta ?? { title: 'Architecture' };

  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: {
      title: meta.title ?? 'Architecture',
      subtitle: meta.subtitle,
      output: meta.output,
      animation: meta.animation,
      viewBox: meta.viewBox,
    },
    components,
    ...(ir.boundaries?.length ? { boundaries: ir.boundaries } : {}),
    ...(connections.length ? { connections } : {}),
    ...(ir.cards?.length ? { cards: ir.cards } : {}),
  };
}

/** Elimina quality_profile y `id` en messages (legacy pre v2.9). */
export function sanitizeArchifySequenceIr(
  ir: ArchifySequenceIr & {
    meta?: ArchifySequenceIr['meta'] & { quality_profile?: string };
    messages?: Array<
      ArchifySequenceIr['messages'][number] & { id?: string }
    >;
  },
): ArchifySequenceIr {
  const { quality_profile: _qp, ...meta } = ir.meta ?? { title: 'Sequence' };

  return {
    schema_version: 1,
    diagram_type: 'sequence',
    meta: {
      title: meta.title ?? 'Sequence',
      subtitle: meta.subtitle,
      output: meta.output,
      animation: meta.animation,
      viewBox: meta.viewBox,
    },
    participants: ir.participants ?? [],
    messages: (ir.messages ?? []).map((m) => ({
      from: m.from,
      to: m.to,
      y: m.y,
      label: m.label,
      variant: m.variant,
      note: m.note,
    })),
    ...(ir.cards?.length ? { cards: ir.cards } : {}),
  };
}
