import type { C4Element, C4Model, C4Relationship } from './c4-model.types.js';

export type ArchifyComponentType =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'cloud'
  | 'security'
  | 'messagebus'
  | 'external';

export interface ArchifyArchitectureIr {
  schema_version: 1;
  diagram_type: 'architecture';
  meta: {
    title: string;
    quality_profile: 'showcase' | 'standard';
    subtitle?: string;
  };
  layout: {
    mode: 'grid';
    cols: number;
    gapX: number;
    gapY: number;
    cellW: number;
    cellH: number;
  };
  components: Array<{
    id: string;
    type: ArchifyComponentType;
    label: string;
    sublabel?: string;
    row?: number;
    col?: number;
  }>;
  connections: Array<{
    id: string;
    from: string;
    to: string;
    label?: string;
    variant?: 'default' | 'emphasis' | 'dashed';
  }>;
  cards?: Array<{ dot: string; title: string; items: string[] }>;
}

function archifyTypeForElement(el: C4Element, level: C4Model['level']): ArchifyComponentType {
  if (el.kind === 'person') return 'cloud';
  if (el.kind === 'external') return 'external';
  if (level === 'context' && el.kind === 'system') return 'backend';
  if (level === 'component' && el.kind === 'component') {
    const pathHint = (el.technology ?? el.name).toLowerCase();
    if (/route|page|view|screen|frontend|tsx|jsx/.test(pathHint)) return 'frontend';
    return 'backend';
  }

  const tech = (el.technology ?? '').toLowerCase();
  const name = el.name.toLowerCase();
  if (/postgres|mysql|mongo|redis|falkor|database|mariadb|elasticsearch/.test(tech + name)) {
    return 'database';
  }
  if (/frontend|web|ui|vite|react/.test(tech + name) || name === 'frontend') {
    return 'frontend';
  }
  if (/queue|kafka|sqs|rabbit|bull/.test(tech + name)) {
    return 'messagebus';
  }
  if (/mcp|orchestrator|ingest|api|nest|backend|cartographer/.test(tech + name)) {
    return 'backend';
  }
  return 'backend';
}

function diagramElements(model: C4Model): C4Element[] {
  if (model.level === 'context') {
    return model.elements.filter((e) =>
      e.kind === 'person' || e.kind === 'system' || e.kind === 'external',
    );
  }
  if (model.level === 'component') {
    return model.elements.filter((e) => e.kind === 'component' || e.kind === 'container');
  }
  return model.elements.filter(
    (e) => e.kind === 'container' || e.kind === 'system' || e.kind === 'external',
  );
}

function diagramRelationships(model: C4Model): C4Relationship[] {
  const ids = new Set(diagramElements(model).map((e) => e.id));
  return model.relationships.filter((r) => ids.has(r.from) && ids.has(r.to) && r.label !== 'contains');
}

/**
 * Mapea C4Model (container) → JSON IR Archify architecture con layout grid.
 */
export function c4ModelToArchifyArchitecture(
  model: C4Model,
  title?: string,
): ArchifyArchitectureIr {
  const nodes = diagramElements(model).filter((e) => {
    if (model.level === 'context') return true;
    if (model.level === 'component') return e.kind === 'component';
    return e.kind !== 'system';
  });
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(nodes.length + 1))));

  const components = nodes.map((el, index) => ({
    id: el.id,
    type: archifyTypeForElement(el, model.level),
    label: el.name,
    sublabel:
      model.level === 'context'
        ? el.description?.slice(0, 64) ?? el.technology?.slice(0, 64)
        : el.technology?.slice(0, 64),
    row: Math.floor(index / cols),
    col: index % cols,
  }));

  const connections = diagramRelationships(model).map((rel) => ({
    id: rel.id,
    from: rel.from,
    to: rel.to,
    label: rel.protocol ?? rel.label,
    variant: rel.protocol ? ('emphasis' as const) : ('default' as const),
  }));

  const dbCount = components.filter((c) => c.type === 'database').length;
  const personCount = model.elements.filter((e) => e.kind === 'person').length;
  const externalCount = model.elements.filter((e) => e.kind === 'external').length;
  const cards: ArchifyArchitectureIr['cards'] = [];
  if (model.systemName) {
    cards.push({
      dot: 'cyan',
      title: model.level === 'context' ? 'Contexto' : 'Sistema',
      items: [
        model.systemName,
        model.level === 'context'
          ? `${externalCount} sistema(s) externo(s)`
          : `${components.length} contenedores`,
      ],
    });
  }
  if (model.level === 'context' && personCount > 0) {
    cards.push({
      dot: 'violet',
      title: 'Actores',
      items: [`${personCount} persona(s)`],
    });
  }
  if (dbCount > 0) {
    cards.push({
      dot: 'emerald',
      title: 'Persistencia',
      items: [`${dbCount} almacén(es) de datos`],
    });
  }

  const defaultTitle =
    model.level === 'context'
      ? `C4 Context — ${model.systemName ?? model.projectId}`
      : model.level === 'component'
        ? `C4 Component — ${model.systemName ?? model.projectId}`
        : `C4 Container — ${model.systemName ?? model.projectId}`;
  const subtitle =
    model.level === 'context'
      ? model.generator === 'hybrid'
        ? 'Nivel contexto (dominios + narrativa LLM)'
        : 'Nivel contexto (determinista desde dominios)'
      : model.level === 'component'
        ? 'Nivel componente (Falkor IMPORTS/RENDERS/CALLS)'
        : model.level === 'container'
          ? 'Nivel contenedor (determinista)'
          : undefined;

  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: {
      title: title ?? defaultTitle,
      quality_profile: 'showcase',
      subtitle,
    },
    layout: {
      mode: 'grid',
      cols,
      gapX: 48,
      gapY: 56,
      cellW: 150,
      cellH: 72,
    },
    components,
    connections,
    ...(cards.length > 0 ? { cards } : {}),
  };
}
