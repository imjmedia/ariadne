import type { ParsedFile } from './parser';

export type StrapiContentTypeRelationEdge = {
  schemaPath: string;
  srcName: string;
  targetUid: string;
  attribute: string;
  relation?: string;
};

/** Extrae pares origen→destino desde schemas parseados (sin Cypher). */
export function collectStrapiContentTypeRelations(
  parsedFiles: readonly ParsedFile[],
): StrapiContentTypeRelationEdge[] {
  const edges: StrapiContentTypeRelationEdge[] = [];
  for (const pf of parsedFiles) {
    for (const ct of pf.strapiContentTypes ?? []) {
      if (!ct.strapiUid) continue;
      for (const attr of ct.attributes ?? []) {
        if (attr.type !== 'relation' || !attr.target) continue;
        edges.push({
          schemaPath: pf.path,
          srcName: ct.name,
          targetUid: attr.target,
          attribute: attr.name,
          relation: attr.relation,
        });
      }
    }
  }
  return edges;
}
