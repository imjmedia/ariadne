/**
 * Parseo de Strapi v4 schema.json bajo content-types (atributos y relaciones para grafo + RAG).
 */
import { isStrapiIndexableJsonPath } from '../providers/sync-path-filter';
import { matchStrapiSchemaJsonPath, type StrapiSchemaPathMatch } from './strapi-path-patterns';

export interface StrapiAttributeField {
  name: string;
  type: string;
  relation?: string;
  target?: string;
  required?: boolean;
  multiple?: boolean;
}

export interface StrapiContentTypeParsed {
  name: string;
  apiName?: string;
  kind?: string;
  collectionName?: string;
  displayName?: string;
  singularName?: string;
  pluralName?: string;
  attributes: StrapiAttributeField[];
  /** Resumen compacto para propiedades en Falkor y búsqueda. */
  attributesSummary: string;
  /** UID Strapi (`api::foo.bar` / `plugin::users-permissions.user`). */
  strapiUid?: string;
}

function normalizeTarget(target: unknown): string | undefined {
  if (typeof target !== 'string' || !target.trim()) return undefined;
  return target.trim();
}

function parseAttributeEntry(name: string, raw: unknown): StrapiAttributeField | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const type = typeof a.type === 'string' ? a.type : 'unknown';
  const field: StrapiAttributeField = {
    name,
    type,
    required: a.required === true,
    multiple: a.multiple === true,
  };
  if (type === 'relation') {
    if (typeof a.relation === 'string') field.relation = a.relation;
    field.target = normalizeTarget(a.target);
  }
  if (type === 'component' && typeof a.component === 'string') {
    field.target = a.component;
  }
  if (type === 'dynamiczone' && Array.isArray(a.components)) {
    field.target = a.components.filter((c) => typeof c === 'string').join(',');
  }
  return field;
}

function buildAttributesSummary(attrs: StrapiAttributeField[]): string {
  return attrs
    .map((f) => {
      if (f.type === 'relation' && f.target) {
        const rel = f.relation ? f.relation + '->' : '->';
        return f.name + ':relation(' + rel + f.target + ')';
      }
      if (f.target && (f.type === 'component' || f.type === 'dynamiczone')) {
        return f.name + ':' + f.type + '(' + f.target + ')';
      }
      const flags = [f.required ? 'required' : null, f.multiple ? 'multiple' : null]
        .filter(Boolean)
        .join(',');
      return flags ? f.name + ':' + f.type + '[' + flags + ']' : f.name + ':' + f.type;
    })
    .join('; ');
}

export function buildStrapiUidFromSchema(
  matched: StrapiSchemaPathMatch,
  info: { singularName?: string; name?: string },
): string {
  const singular = (info.singularName ?? info.name ?? matched.name).toLowerCase();
  if (matched.source === 'extension') {
    return `plugin::${matched.apiName}.${singular}`;
  }
  return `api::${matched.apiName}.${singular}`;
}

/**
 * Parsea schema.json de Strapi v4. Devuelve null si el path no aplica o el JSON es invalido.
 */
export function parseStrapiSchemaJson(path: string, source: string): StrapiContentTypeParsed | null {
  const norm = path.replace(/\\/g, '/');
  if (!isStrapiIndexableJsonPath(norm) || !/\/schema\.json$/i.test(norm)) return null;

  const matched = matchStrapiSchemaJsonPath(norm);
  if (!matched) return null;

  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(source) as Record<string, unknown>;
  } catch {
    return null;
  }

  const info =
    doc.info && typeof doc.info === 'object' ? (doc.info as Record<string, unknown>) : {};
  const attrsRaw =
    doc.attributes && typeof doc.attributes === 'object'
      ? (doc.attributes as Record<string, unknown>)
      : {};

  const attributes: StrapiAttributeField[] = [];
  for (const [name, raw] of Object.entries(attrsRaw)) {
    const field = parseAttributeEntry(name, raw);
    if (field) attributes.push(field);
  }

  const displayName =
    typeof info.displayName === 'string' ? info.displayName.trim() : undefined;
  const singularName = typeof info.singularName === 'string' ? info.singularName : undefined;
  const infoName = typeof info.name === 'string' ? info.name : undefined;

  return {
    name: matched.name,
    apiName: matched.apiName,
    kind: typeof doc.kind === 'string' ? doc.kind : undefined,
    collectionName:
      typeof doc.collectionName === 'string' ? doc.collectionName : undefined,
    displayName,
    singularName,
    pluralName: typeof info.pluralName === 'string' ? info.pluralName : undefined,
    attributes,
    attributesSummary: buildAttributesSummary(attributes),
    strapiUid: buildStrapiUidFromSchema(matched, {
      singularName,
      name: infoName ?? matched.name,
    }),
  };
}

/** Bloques markdown para el doc RAG de esquema relacional. */
export function formatStrapiSchemasForRag(
  entries: Array<{ path: string; schema: StrapiContentTypeParsed }>,
): string[] {
  const lines: string[] = [];
  lines.push('### Strapi (content-types / schema.json)');
  lines.push('');
  if (entries.length === 0) {
    lines.push('_(No hay schema.json de content-types en este snapshot.)_');
    lines.push('');
    return lines;
  }
  for (const { path, schema } of entries) {
    const label = schema.displayName ?? schema.name;
    const coll = schema.collectionName ? ' - coleccion `' + schema.collectionName + '`' : '';
    const kind = schema.kind ? ' (' + schema.kind + ')' : '';
    lines.push('- **' + label + '** `' + schema.name + '`' + kind + coll + ' - `' + path + '`');
    if (schema.attributes.length === 0) {
      lines.push('  - _(sin attributes en schema)_');
    } else {
      for (const a of schema.attributes) {
        if (a.type === 'relation' && a.target) {
          lines.push(
            '  - `' +
              a.name +
              '`: relation ' +
              (a.relation ?? '') +
              ' -> `' +
              a.target +
              '`' +
              (a.required ? ' (required)' : ''),
          );
        } else {
          const extra = a.target ? ' (' + a.target + ')' : '';
          lines.push(
            '  - `' +
              a.name +
              '`: ' +
              a.type +
              extra +
              (a.required ? ' (required)' : '') +
              (a.multiple ? ' (multiple)' : ''),
          );
        }
      }
    }
    lines.push('');
  }
  return lines;
}
