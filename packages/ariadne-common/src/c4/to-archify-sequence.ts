import type { C4Evidence } from './c4-model.types.js';

export interface ApiFlowStep {
  id: string;
  from: string;
  to: string;
  label: string;
  variant?: 'default' | 'emphasis' | 'return' | 'dashed' | 'security';
}

export interface ApiFlowSpec {
  title: string;
  routePath?: string;
  screenName?: string;
  apiPath?: string;
  backendPath?: string;
  method?: string;
  participants: Array<{ id: string; label: string; sublabel?: string; type: string }>;
  steps: ApiFlowStep[];
  evidence: C4Evidence[];
}

/** IR Archify v2.9+ (sequence.schema.json). */
export interface ArchifySequenceIr {
  schema_version: 1;
  diagram_type: 'sequence';
  meta: {
    title: string;
    subtitle?: string;
    output?: string;
    animation?: 'trace' | 'none';
    viewBox?: [number, number];
  };
  participants: Array<{ id: string; type: string; label: string; sublabel?: string }>;
  messages: Array<{
    from: string;
    to: string;
    y: number;
    label: string;
    variant?: 'default' | 'emphasis' | 'security' | 'dashed' | 'return';
    note?: string;
  }>;
  cards?: Array<{ dot: string; title: string; items: string[] }>;
}

/**
 * Mapea un flujo API representativo (Route → API → backend) a IR Archify sequence.
 */
export function apiFlowToArchifySequence(spec: ApiFlowSpec): ArchifySequenceIr {
  const yStart = 180;
  const yStep = 48;
  const messages = spec.steps
    .filter((step) => step.from !== step.to)
    .map((step, index) => ({
      from: step.from,
      to: step.to,
      y: yStart + index * yStep,
      label: step.label,
      variant: step.variant ?? (step.label.toLowerCase().includes('200') ? 'return' : 'default'),
    }));

  const cards: ArchifySequenceIr['cards'] = [];
  if (spec.routePath) {
    cards.push({
      dot: 'cyan',
      title: 'Ruta',
      items: [spec.routePath, spec.screenName ?? 'pantalla'],
    });
  }
  if (spec.apiPath || spec.backendPath) {
    cards.push({
      dot: 'emerald',
      title: 'API',
      items: [
        spec.method ? `${spec.method} ${spec.apiPath ?? spec.backendPath}` : (spec.apiPath ?? spec.backendPath ?? ''),
      ].filter(Boolean),
    });
  }

  return {
    schema_version: 1,
    diagram_type: 'sequence',
    meta: {
      title: spec.title,
      subtitle: spec.routePath
        ? `${spec.routePath} · ${spec.participants.find((p) => p.id === 'web')?.label ?? 'Web'} → ${spec.participants.find((p) => p.id === 'api')?.label ?? 'API'}`
        : 'Flujo API inferido desde Falkor (Route / REFERENCES_API / Nest)',
      viewBox: [820, Math.max(520, yStart + spec.steps.length * yStep + 80)],
    },
    participants: spec.participants.map((p) => ({
      id: p.id,
      type: p.type,
      label: p.label,
      sublabel: p.sublabel,
    })),
    messages,
    ...(cards.length > 0 ? { cards } : {}),
  };
}
