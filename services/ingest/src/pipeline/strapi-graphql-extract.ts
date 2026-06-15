/**
 * Extrae queries/mutations custom de `schema.graphql` Strapi v4 (module.exports con bloques query/mutation/resolver).
 */

export type GraphQlOperationKind = 'query' | 'mutation';

export interface GraphQlQueryInfo {
  name: string;
  apiName: string;
  operationKind: GraphQlOperationKind;
  description?: string;
  resolverOf?: string;
  /** Sufijo de handler Strapi tras el punto (`Medios.cercanos` → `cercanos`). */
  resolverAction?: string;
}

const GRAPHQL_SCALAR = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);

function extractOperationBlock(source: string, kind: GraphQlOperationKind): string | null {
  const re = new RegExp(`${kind}\\s*:\\s*(?:/\\*[^*]*\\*/\\s*)?\`([\\s\\S]*?)\``, 'i');
  const m = source.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractFieldNamesFromGraphQlBlock(block: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const fieldRe = /\b([a-zA-Z_]\w*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(block)) !== null) {
    const name = m[1]!;
    if (GRAPHQL_SCALAR.has(name) || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function enrichFromResolverBlock(source: string, queries: GraphQlQueryInfo[]): void {
  for (const q of queries) {
    const idx = source.indexOf(`${q.name}:`);
    if (idx < 0) continue;
    const slice = source.slice(idx, idx + 800);
    const descM = slice.match(/description\s*:\s*['"`]([^'"`]+)['"`]/);
    const resM = slice.match(/resolverOf\s*:\s*['"`]([^'"`]+)['"`]/);
    if (descM?.[1]) q.description = descM[1].slice(0, 500);
    if (resM?.[1]) {
      q.resolverOf = resM[1].slice(0, 200);
      const dot = resM[1].indexOf('.');
      if (dot >= 0 && dot < resM[1].length - 1) {
        q.resolverAction = resM[1].slice(dot + 1).trim();
      }
    }
  }
}

/** Parsea `src/api/{api}/config/schema.graphql` → operaciones GraphQL declaradas. */
export function parseStrapiGraphqlSchema(path: string, source: string): GraphQlQueryInfo[] {
  const norm = path.replace(/\\/g, '/');
  const apiMatch = norm.match(/\/api\/([^/]+)\/config\/schema\.graphql$/i);
  if (!apiMatch) return [];

  const apiName = apiMatch[1]!;
  const out: GraphQlQueryInfo[] = [];

  for (const kind of ['query', 'mutation'] as const) {
    const block = extractOperationBlock(source, kind);
    if (!block) continue;
    for (const name of extractFieldNamesFromGraphQlBlock(block)) {
      out.push({ name, apiName, operationKind: kind });
    }
  }

  enrichFromResolverBlock(source, out);
  return out;
}
