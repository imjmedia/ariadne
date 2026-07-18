/**
 * Genera bloques Mermaid `erDiagram` con atributos de entidad + relaciones.
 */
import {
  inferTypeOrmRelationsFromModels,
  parseModelFieldSummary,
} from '../pipeline/typeorm-schema.util';

export function sanitizeMermaidEntityName(name: string): string {
  const cleaned = (name ?? '').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'Entity';
}

function sanitizeMermaidFieldName(name: string): string {
  const cleaned = (name ?? '').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'field';
}

function sanitizeMermaidType(type: string): string {
  const cleaned = (type ?? 'string').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 32) || 'string';
}

function mermaidTypeFromFieldHint(
  hint: string | undefined,
  fieldName: string,
): { type: string; markers: string } {
  const lc = fieldName.toLowerCase();
  if (lc === 'id' || hint?.includes('PrimaryGenerated') || hint?.includes('PrimaryColumn')) {
    return { type: 'string', markers: ' PK' };
  }
  if (/Id$/.test(fieldName) && fieldName.length > 2) {
    return { type: 'string', markers: ' FK' };
  }
  if (hint?.startsWith('Embedded(')) {
    return { type: 'embedded', markers: '' };
  }
  if (hint?.startsWith('relation(')) {
    return { type: 'relation', markers: '' };
  }
  if (hint && /^[A-Z][A-Za-z0-9_]*$/.test(hint)) {
    return { type: hint, markers: '' };
  }
  if (hint) {
    const dateDecorators = ['CreateDateColumn', 'UpdateDateColumn', 'DeleteDateColumn'];
    if (dateDecorators.some((d) => hint.startsWith(d))) return { type: 'datetime', markers: '' };
    const colMatch = hint.match(/^Column\(([^)]*)\)/);
    if (colMatch) {
      const inner = colMatch[1]?.replace(/['"]/g, '').trim() ?? '';
      const typeMatch = inner.match(/type\s*:\s*['"]?([A-Za-z0-9_]+)/);
      if (typeMatch?.[1]) return { type: sanitizeMermaidType(typeMatch[1]), markers: '' };
      if (inner && !inner.includes('{')) return { type: sanitizeMermaidType(inner.split(',')[0] ?? 'string'), markers: '' };
    }
    const primitive = hint.split(/[,({\[]/)[0]?.trim();
    if (primitive && /^(string|number|boolean|Date|json|uuid|text|int|float|decimal|bigint)/i.test(primitive)) {
      return { type: sanitizeMermaidType(primitive), markers: '' };
    }
  }
  return { type: 'string', markers: '' };
}

export function modelFieldSummaryToMermaidAttributes(fieldSummary: unknown, maxFields = 48): string[] {
  const fields = parseModelFieldSummary(fieldSummary);
  const lines: string[] = [];
  for (const raw of fields.slice(0, maxFields)) {
    const colonIdx = raw.indexOf(':');
    const rawName = colonIdx >= 0 ? raw.slice(0, colonIdx).trim() : raw.trim();
    const hint = colonIdx >= 0 ? raw.slice(colonIdx + 1).trim() : undefined;
    const fieldName = sanitizeMermaidFieldName(rawName);
    const { type, markers } = mermaidTypeFromFieldHint(hint, fieldName);
    lines.push(`    ${sanitizeMermaidType(type)} ${fieldName}${markers}`);
  }
  return lines;
}

export function strapiAttributesSummaryToMermaidAttributes(
  attributesSummary: unknown,
  maxFields = 48,
): string[] {
  const text = String(attributesSummary ?? '').trim();
  if (!text) return [];
  const lines: string[] = [];
  for (const part of text.split(';').map((s) => s.trim()).filter(Boolean).slice(0, maxFields)) {
    const colonIdx = part.indexOf(':');
    const rawName = colonIdx >= 0 ? part.slice(0, colonIdx).trim() : part.trim();
    const hint = colonIdx >= 0 ? part.slice(colonIdx + 1).trim() : 'string';
    const fieldName = sanitizeMermaidFieldName(rawName);
    let type = 'string';
    let markers = '';
    if (hint.startsWith('relation(')) {
      type = 'relation';
    } else if (hint.startsWith('component(') || hint.startsWith('dynamiczone(')) {
      type = hint.split('(')[0] ?? 'component';
    } else {
      type = hint.split('[')[0]?.trim() || 'string';
    }
    if (fieldName.toLowerCase() === 'id') markers = ' PK';
    lines.push(`    ${sanitizeMermaidType(type)} ${fieldName}${markers}`);
  }
  return lines;
}

export interface ErDiagramBuildInput {
  contentTypes: Record<string, unknown>[];
  ctRel: Record<string, unknown>[];
  models: Record<string, unknown>[];
  modelRel: Record<string, unknown>[];
  maxRelations?: number;
  maxFieldsPerEntity?: number;
}

export function buildErDiagramMermaid(input: ErDiagramBuildInput): {
  diagram: string | null;
  usedInference: boolean;
} {
  const {
    contentTypes,
    ctRel,
    models,
    modelRel,
    maxRelations = 200,
    maxFieldsPerEntity = 48,
  } = input;

  const entityAttributes = new Map<string, string[]>();

  const setEntityAttributes = (rawName: unknown, attrs: string[]) => {
    const name = sanitizeMermaidEntityName(String(rawName ?? ''));
    if (!name || attrs.length === 0) return;
    const existing = entityAttributes.get(name) ?? [];
    if (attrs.length > existing.length) entityAttributes.set(name, attrs);
  };

  for (const m of models) {
    setEntityAttributes(
      m.name,
      modelFieldSummaryToMermaidAttributes(m.fieldSummary, maxFieldsPerEntity),
    );
  }
  for (const ct of contentTypes) {
    setEntityAttributes(
      ct.name,
      strapiAttributesSummaryToMermaidAttributes(ct.attributesSummary, maxFieldsPerEntity),
    );
  }

  const rels: string[] = [];
  const seenRels = new Set<string>();
  const relatedEntities = new Set<string>();
  let indexedRelCount = 0;

  const pushRel = (from: unknown, to: unknown, label: string) => {
    const a = sanitizeMermaidEntityName(String(from ?? ''));
    const b = sanitizeMermaidEntityName(String(to ?? ''));
    if (!a || !b) return;
    relatedEntities.add(a);
    relatedEntities.add(b);
    const lbl = (label || 'rel').replace(/[^A-Za-z0-9_ -]/g, '').trim().slice(0, 40) || 'rel';
    const line = `  ${a} ||--o{ ${b} : "${lbl}"`;
    if (seenRels.has(line)) return;
    seenRels.add(line);
    rels.push(line);
  };

  for (const r of ctRel) {
    pushRel(r.fromEntity, r.toEntity, String(r.relation || r.attribute || 'rel'));
    indexedRelCount++;
  }
  for (const r of modelRel) {
    pushRel(r.fromEntity, r.toEntity, String(r.field || 'rel'));
    indexedRelCount++;
  }

  const beforeInference = rels.length;
  for (const r of inferTypeOrmRelationsFromModels(models)) {
    pushRel(r.fromEntity, r.toEntity, r.field);
  }
  const usedInference = indexedRelCount === 0 && rels.length > beforeInference;

  if (rels.length === 0 && entityAttributes.size === 0) {
    return { diagram: null, usedInference: false };
  }

  for (const entityName of relatedEntities) {
    if (!entityAttributes.has(entityName)) entityAttributes.set(entityName, []);
  }

  const entityBlocks: string[] = [];
  for (const name of [...entityAttributes.keys()].sort()) {
    const attrs = entityAttributes.get(name) ?? [];
    entityBlocks.push(`  ${name} {`, ...attrs, `  }`);
  }

  const lines = ['erDiagram', ...entityBlocks, ...rels.slice(0, maxRelations)];
  return { diagram: lines.join('\n'), usedInference };
}
