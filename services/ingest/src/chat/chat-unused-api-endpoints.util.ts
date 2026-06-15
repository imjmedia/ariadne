/**
 * Detección y Cypher para cruce front (`ApiClientReference`) vs back (`StrapiRoute`).
 */
import { strapiRouteMatchesNormalizedPathCypher } from '../pipeline/strapi-route-path-match';

export function wantsUnusedBackendApiEndpointsAnalysis(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  const explicit =
    /qu[eé]\s+(endpoints?|rutas?)\b/i.test(t) &&
    /\b(no|sin)\b/i.test(lower) &&
    /\b(us|uso|usad|consum|referencia)/i.test(lower) ||
    /(endpoints?|rutas?)\s+(del|de)\s+(back|backend|strapi|servidor)/i.test(lower) &&
      /\b(no|sin)\b/i.test(lower) &&
      /\b(us|front|frontend|cliente)/i.test(lower) ||
    /\bunused\b/i.test(lower) &&
      /\b(endpoints?|routes?|api)\b/i.test(lower) &&
      /\b(front|frontend|client)/i.test(lower);

  if (explicit) return true;

  const backendApi =
    (/\b(endpoints?|rutas?)\b/i.test(t) &&
      /\b(back|backend|strapi|servidor|api\s+rest)\b/i.test(lower)) ||
    /\bstrapi\s*rout/i.test(lower);

  const unusedIntent =
    /\b(no\s+(se\s+)?us|sin\s+uso|no\s+usad|huérfan|huerfan|sin\s+referencia|no\s+consum)/i.test(lower) ||
    /\ben\s+el\s+front/i.test(lower) ||
    /\bfront.*no\s+us/i.test(lower);

  return backendApi && unusedIntent;
}

function frontRefHeuristicMatchCypher(refVar: string, srVar: string): string {
  return `(${refVar}.projectId = ${srVar}.projectId AND ${refVar}.repoId <> ${srVar}.repoId AND (${strapiRouteMatchesNormalizedPathCypher(refVar, srVar)}))`;
}

/** Rutas custom sin consumidor conocido (excluye core_router y auth:false). */
export function unusedCustomStrapiRoutesCypher(limit: number): string {
  const heuristic = frontRefHeuristicMatchCypher('ref', 'sr');
  return `MATCH (sr:StrapiRoute)
WHERE sr.projectId = $projectId
AND sr.routeSource <> 'core_router'
AND coalesce(sr.publicRoute, 'false') <> 'true'
AND NOT EXISTS { MATCH (:ApiClientReference)-[:CALLS_STRAPI_ROUTE]->(sr) }
AND NOT EXISTS { MATCH (:ExternalApiReference)-[:CALLS_STRAPI_ROUTE]->(sr) }
AND NOT EXISTS { MATCH (:File)-[:INVOKES_STRAPI_ROUTE]->(sr) }
AND NOT EXISTS { MATCH (ref:ApiClientReference) WHERE ${heuristic} }
RETURN sr.method AS method, sr.routePath AS routePath, sr.apiName AS apiName, sr.routeSource AS routeSource
ORDER BY sr.routePath, sr.method
LIMIT ${limit}`;
}

/** @deprecated Alias — usa unusedCustomStrapiRoutesCypher */
export function unusedStrapiRoutesCypher(limit: number): string {
  return unusedCustomStrapiRoutesCypher(limit);
}

export function usedStrapiRoutesCypher(limit: number): string {
  return `MATCH (ref:ApiClientReference)-[:CALLS_STRAPI_ROUTE]->(sr:StrapiRoute)
WHERE ref.projectId = $projectId
RETURN ref.filePath AS file, ref.apiPath AS apiPath, sr.method AS method, sr.routePath AS routePath, sr.apiName AS apiName, 'front' AS consumer
ORDER BY sr.routePath, sr.method
LIMIT ${limit}`;
}

export function usedStrapiRoutesHeuristicCypher(limit: number): string {
  const heuristic = frontRefHeuristicMatchCypher('ref', 'sr');
  return `MATCH (sr:StrapiRoute), (ref:ApiClientReference)
WHERE sr.projectId = $projectId AND ref.projectId = $projectId
AND NOT (ref)-[:CALLS_STRAPI_ROUTE]->(sr)
AND ${heuristic}
RETURN DISTINCT ref.filePath AS file, ref.apiPath AS apiPath, sr.method AS method, sr.routePath AS routePath, sr.apiName AS apiName, 'front_heuristic' AS consumer
ORDER BY sr.routePath, sr.method
LIMIT ${limit}`;
}

export function internalStrapiRouteConsumersCypher(limit: number): string {
  return `MATCH (f:File)-[:INVOKES_STRAPI_ROUTE]->(sr:StrapiRoute)
WHERE sr.projectId = $projectId
RETURN DISTINCT f.path AS sourceFile, sr.method AS method, sr.routePath AS routePath, sr.apiName AS apiName, 'internal' AS consumer
ORDER BY sr.routePath, sr.method
LIMIT ${limit}`;
}

export function externalStrapiRouteConsumersCypher(limit: number): string {
  return `MATCH (ear:ExternalApiReference)-[:CALLS_STRAPI_ROUTE]->(sr:StrapiRoute)
WHERE sr.projectId = $projectId
RETURN DISTINCT ear.service AS service, ear.apiPath AS apiPath, sr.method AS method, sr.routePath AS routePath, sr.apiName AS apiName, 'external' AS consumer
ORDER BY sr.routePath, sr.method
LIMIT ${limit}`;
}

export function publicStrapiRoutesCypher(limit: number): string {
  return `MATCH (sr:StrapiRoute)
WHERE sr.projectId = $projectId AND coalesce(sr.publicRoute, 'false') = 'true'
RETURN sr.method AS method, sr.routePath AS routePath, sr.apiName AS apiName, sr.routeSource AS routeSource
ORDER BY sr.routePath, sr.method
LIMIT ${limit}`;
}

export function coreRouterStrapiRoutesCountCypher(): string {
  return `MATCH (sr:StrapiRoute) WHERE sr.projectId = $projectId AND sr.routeSource = 'core_router' RETURN count(sr) AS c`;
}
