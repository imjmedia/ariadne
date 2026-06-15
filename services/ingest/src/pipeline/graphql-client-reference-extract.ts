/**
 * Referencias GraphQL en frontend (`gql`/`graphql` templates) → operaciones Strapi custom.
 */

export interface GraphQlClientReferenceParsed {
  operationName: string;
  /** Campo raíz en documento anónimo (p. ej. `mediosCercanos`). */
  rootField: string;
  filePath?: string;
}

const GQL_TAG_RE = /(?:gql|graphql)\s*`([^`]+)`/gs;

const NAMED_OPERATION_RE = /(?:query|mutation)\s+(\w+)\s*[\({]/gi;

/** Primer campo tras `{` en documentos anónimos o dentro de operaciones. */
const ROOT_FIELD_RE = /{\s*(\w+)\s*[\({]/g;

function pushUnique(seen: Set<string>, out: GraphQlClientReferenceParsed[], opName: string, rootField: string) {
  const operationName = opName.trim();
  const field = rootField.trim();
  if (!field || field.length < 2) return;
  const key = `${operationName}|${field}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    operationName: operationName || field,
    rootField: field,
  });
}

/** Extrae nombres de operación/campo raíz de templates GraphQL en TS/JS. */
export function extractGraphQlClientReferences(source: string): GraphQlClientReferenceParsed[] {
  const seen = new Set<string>();
  const out: GraphQlClientReferenceParsed[] = [];

  GQL_TAG_RE.lastIndex = 0;
  let block: RegExpExecArray | null;
  while ((block = GQL_TAG_RE.exec(source)) !== null) {
    const doc = block[1] ?? '';
    if (!doc.trim()) continue;

    const namedOps: string[] = [];
    NAMED_OPERATION_RE.lastIndex = 0;
    let nm: RegExpExecArray | null;
    while ((nm = NAMED_OPERATION_RE.exec(doc)) !== null) {
      namedOps.push(nm[1]!);
    }

    const rootFields: string[] = [];
    ROOT_FIELD_RE.lastIndex = 0;
    let rf: RegExpExecArray | null;
    while ((rf = ROOT_FIELD_RE.exec(doc)) !== null) {
      const name = rf[1]!;
      if (['query', 'mutation', 'subscription', '__typename'].includes(name)) continue;
      rootFields.push(name);
    }

    if (namedOps.length > 0) {
      for (const op of namedOps) {
        const field = rootFields[0] ?? op;
        pushUnique(seen, out, op, field);
      }
    } else if (rootFields.length > 0) {
      for (const field of rootFields) {
        pushUnique(seen, out, field, field);
      }
    }
  }

  return out;
}

/** Detecta uso del endpoint HTTP `/graphql` (sin operación resoluble). */
export function sourceReferencesGraphQlEndpoint(source: string): boolean {
  return /['"`]\/graphql['"`]|\/graphql\b/i.test(source);
}
