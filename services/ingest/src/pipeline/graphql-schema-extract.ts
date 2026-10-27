/**
 * @fileoverview Extractor para esquemas y operaciones GraphQL (.graphql, .gql).
 * Mapea tipos (type, input, interface, enum, union) y operaciones (query, mutation, subscription).
 */

export type GraphQlTypeKind = 'type' | 'interface' | 'input' | 'enum' | 'union';

export interface GraphQlTypeInfo {
  name: string;
  kind: GraphQlTypeKind;
  fields: string[];
  description?: string;
}

export type GraphQlOperationKind = 'query' | 'mutation' | 'subscription';

export interface GraphQlOperationInfo {
  name: string;
  operationKind: GraphQlOperationKind;
  description?: string;
}

export interface GenericGraphQlExtractResult {
  types: GraphQlTypeInfo[];
  operations: GraphQlOperationInfo[];
}

const COMMENTS_RE = /#[^\r\n]*/g;
const BLOCK_COMMENTS_RE = /"""[\s\S]*?"""/g;

/** Extrae nombres de campos dentro de bloques `{ ... }`. */
function extractFieldNames(block: string): string[] {
  const fields: string[] = [];
  const seen = new Set<string>();
  const lines = block.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Captura `fieldName(` o `fieldName:` o `ENUM_VALUE`
    const match = trimmed.match(/^([a-zA-Z_]\w*)\s*(?:[:\(]|$)/);
    if (match) {
      const name = match[1]!;
      if (!seen.has(name)) {
        seen.add(name);
        fields.push(name);
      }
    }
  }
  return fields;
}

/**
 * Parsea el contenido de un archivo `.graphql` o `.gql`.
 */
export function parseGenericGraphQl(path: string, source: string): GenericGraphQlExtractResult {
  const types: GraphQlTypeInfo[] = [];
  const operations: GraphQlOperationInfo[] = [];
  const seenTypes = new Set<string>();
  const seenOps = new Set<string>();

  // Limpiar comentarios de bloque y de línea para no confundir bloques
  const cleanSource = source
    .replace(BLOCK_COMMENTS_RE, '')
    .replace(COMMENTS_RE, '');

  // 1. Tipos estructurados: type, interface, input, enum
  const TYPE_BLOCK_RE = /\b(type|interface|input|enum)\s+([a-zA-Z_]\w*)(?:\s+implements\s+[^{]+)?\s*\{([^}]*)\}/gi;
  let match: RegExpExecArray | null;

  while ((match = TYPE_BLOCK_RE.exec(cleanSource)) !== null) {
    const rawKind = match[1]!.toLowerCase() as GraphQlTypeKind;
    const name = match[2]!;
    const body = match[3] ?? '';

    // Manejo especial para root operations en schema SDL:
    // `type Query { getUser: User }` o `type Mutation { ... }`
    if (name.toLowerCase() === 'query') {
      const fields = extractFieldNames(body);
      for (const f of fields) {
        if (!seenOps.has(`query:${f}`)) {
          seenOps.add(`query:${f}`);
          operations.push({ name: f, operationKind: 'query' });
        }
      }
      continue;
    }
    if (name.toLowerCase() === 'mutation') {
      const fields = extractFieldNames(body);
      for (const f of fields) {
        if (!seenOps.has(`mutation:${f}`)) {
          seenOps.add(`mutation:${f}`);
          operations.push({ name: f, operationKind: 'mutation' });
        }
      }
      continue;
    }
    if (name.toLowerCase() === 'subscription') {
      const fields = extractFieldNames(body);
      for (const f of fields) {
        if (!seenOps.has(`subscription:${f}`)) {
          seenOps.add(`subscription:${f}`);
          operations.push({ name: f, operationKind: 'subscription' });
        }
      }
      continue;
    }

    if (!seenTypes.has(name)) {
      seenTypes.add(name);
      types.push({
        name,
        kind: rawKind,
        fields: extractFieldNames(body),
      });
    }
  }

  // 2. Unions: `union SearchResult = Photo | Person`
  const UNION_RE = /\bunion\s+([a-zA-Z_]\w*)\s*=\s*([^;\r\n]+)/gi;
  while ((match = UNION_RE.exec(cleanSource)) !== null) {
    const name = match[1]!;
    const members = match[2]!
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!seenTypes.has(name)) {
      seenTypes.add(name);
      types.push({
        name,
        kind: 'union',
        fields: members,
      });
    }
  }

  // 3. Operaciones ejecutables en archivos .graphql (query Foo, mutation Bar)
  const EXEC_OP_RE = /\b(query|mutation|subscription)\s+([a-zA-Z_]\w*)\s*(?:\([^)]*\))?\s*\{/gi;
  while ((match = EXEC_OP_RE.exec(cleanSource)) !== null) {
    const kind = match[1]!.toLowerCase() as GraphQlOperationKind;
    const name = match[2]!;
    const key = `${kind}:${name}`;

    if (!seenOps.has(key)) {
      seenOps.add(key);
      operations.push({ name, operationKind: kind });
    }
  }

  return { types, operations };
}
