/**
 * Enlaces post-sync entre referencias `api/...` del frontend y operaciones OpenAPI del backend
 * dentro del mismo proyecto Ariadne (multi-root).
 */
import { cypherSafe } from 'ariadne-common';

/** MERGE (ApiClientReference)-[:CALLS_API]->(OpenApiOperation) por coincidencia de path. */
export function buildCrossRepoApiLinkCypher(projectId: string): string[] {
  const pid = cypherSafe(projectId);
  return [
    `MATCH (ref:ApiClientReference {projectId: ${pid}}) MATCH (op:OpenApiOperation {projectId: ${pid}}) WHERE ref.repoId <> op.repoId AND (op.pathTemplate = '/' + ref.normalizedPath OR op.pathTemplate STARTS WITH '/' + ref.normalizedPath + '/' OR op.pathTemplate = '/api/' + ref.normalizedPath OR op.pathTemplate STARTS WITH '/api/' + ref.normalizedPath + '/') MERGE (ref)-[:CALLS_API]->(op)`,
  ];
}
