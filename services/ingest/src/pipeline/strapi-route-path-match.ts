/**
 * Predicados Cypher reutilizables: literal `api/…` ↔ `StrapiRoute.routePath`.
 * Usado en post-sync (`cross-repo-api-link`) y en chat (unused endpoints).
 */
export function strapiRouteMatchesNormalizedPathCypher(refVar: string, srVar: string): string {
  const np = `${refVar}.normalizedPath`;
  const rp = `${srVar}.routePath`;
  return [
    `${rp} = '/' + ${np}`,
    `${rp} STARTS WITH '/' AND ${np} ENDS WITH substring(${rp}, 1)`,
    `(${srVar}.apiName IS NOT NULL AND trim(${srVar}.apiName) <> '' AND ${np} = ${srVar}.apiName + substring(${rp}, 1))`,
    `(${refVar}.isDynamic = 'true' AND (${rp} = '/' + ${np} OR ${rp} STARTS WITH '/' + ${np} + '/'))`,
  ].join(' OR ');
}
