import type { C4Element, C4Model, C4Relationship } from './c4-model.types.js';

export interface C4ElementDiff {
  id: string;
  name: string;
  kind: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  before?: C4Element;
  after?: C4Element;
  changedFields?: string[];
}

export interface C4RelationshipDiff {
  id: string;
  status: 'added' | 'removed' | 'unchanged';
  before?: C4Relationship;
  after?: C4Relationship;
}

export interface C4ModelDiff {
  level: string;
  fromContentHash: string;
  toContentHash: string;
  summary: {
    elementsAdded: number;
    elementsRemoved: number;
    elementsChanged: number;
    relationshipsAdded: number;
    relationshipsRemoved: number;
  };
  elements: C4ElementDiff[];
  relationships: C4RelationshipDiff[];
}

function elementSignature(el: C4Element): string {
  return JSON.stringify({
    kind: el.kind,
    name: el.name,
    technology: el.technology ?? null,
    description: el.description ?? null,
    containerKey: el.containerKey ?? null,
  });
}

function relSignature(rel: C4Relationship): string {
  return JSON.stringify({
    from: rel.from,
    to: rel.to,
    label: rel.label ?? null,
    protocol: rel.protocol ?? null,
  });
}

/** Diff determinista entre dos C4Model del mismo nivel. */
export function diffC4Models(from: C4Model, to: C4Model): C4ModelDiff {
  const fromById = new Map(from.elements.map((e) => [e.id, e] as const));
  const toById = new Map(to.elements.map((e) => [e.id, e] as const));
  const allIds = new Set([...fromById.keys(), ...toById.keys()]);

  const elements: C4ElementDiff[] = [];
  let elementsAdded = 0;
  let elementsRemoved = 0;
  let elementsChanged = 0;

  for (const id of allIds) {
    const before = fromById.get(id);
    const after = toById.get(id);
    if (before && after) {
      const changed = elementSignature(before) !== elementSignature(after);
      if (changed) elementsChanged++;
      elements.push({
        id,
        name: after.name,
        kind: after.kind,
        status: changed ? 'changed' : 'unchanged',
        before,
        after,
        changedFields: changed ? ['name', 'technology', 'description'] : undefined,
      });
    } else if (after) {
      elementsAdded++;
      elements.push({ id, name: after.name, kind: after.kind, status: 'added', after });
    } else if (before) {
      elementsRemoved++;
      elements.push({ id, name: before.name, kind: before.kind, status: 'removed', before });
    }
  }

  const fromRel = new Map(from.relationships.map((r) => [r.id, r] as const));
  const toRel = new Map(to.relationships.map((r) => [r.id, r] as const));
  const relIds = new Set([...fromRel.keys(), ...toRel.keys()]);
  const relationships: C4RelationshipDiff[] = [];
  let relationshipsAdded = 0;
  let relationshipsRemoved = 0;

  for (const id of relIds) {
    const before = fromRel.get(id);
    const after = toRel.get(id);
    if (before && after) {
      const changed = relSignature(before) !== relSignature(after);
      relationships.push({
        id,
        status: changed ? 'added' : 'unchanged',
        before,
        after,
      });
      if (changed) {
        relationshipsAdded++;
        relationshipsRemoved++;
      }
    } else if (after) {
      relationshipsAdded++;
      relationships.push({ id, status: 'added', after });
    } else if (before) {
      relationshipsRemoved++;
      relationships.push({ id, status: 'removed', before });
    }
  }

  return {
    level: to.level,
    fromContentHash: from.contentHash,
    toContentHash: to.contentHash,
    summary: {
      elementsAdded,
      elementsRemoved,
      elementsChanged,
      relationshipsAdded,
      relationshipsRemoved,
    },
    elements,
    relationships,
  };
}
