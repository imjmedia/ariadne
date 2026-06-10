/**
 * Cypher RELATES_TO entre StrapiContentType por targets en attributes.
 */
import { cypherSafe } from 'ariadne-common';
import type { ParsedFile } from './parser';
import { collectStrapiContentTypeRelations } from './strapi-content-type-relations-collect';

export type { StrapiContentTypeRelationEdge } from './strapi-content-type-relations-collect';
export { collectStrapiContentTypeRelations } from './strapi-content-type-relations-collect';

export function buildStrapiContentTypeRelationCypher(
  parsedFiles: readonly ParsedFile[],
  projectId: string,
  repoId: string,
): string[] {
  const pid = cypherSafe(projectId);
  const rid = cypherSafe(repoId);
  const statements: string[] = [];

  for (const edge of collectStrapiContentTypeRelations(parsedFiles)) {
    const attrName = cypherSafe(edge.attribute);
    const relation = edge.relation != null ? cypherSafe(edge.relation) : 'null';
    const targetUid = cypherSafe(edge.targetUid);
    statements.push(
      `MATCH (src:StrapiContentType {path: ${cypherSafe(edge.schemaPath)}, name: ${cypherSafe(edge.srcName)}, projectId: ${pid}, repoId: ${rid}}) MATCH (tgt:StrapiContentType {strapiUid: ${targetUid}, projectId: ${pid}, repoId: ${rid}}) MERGE (src)-[:RELATES_TO {attribute: ${attrName}, relation: ${relation}}]->(tgt)`,
    );
  }

  return statements;
}
