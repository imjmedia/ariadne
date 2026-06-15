/**
 * Predicados Cypher: literal front (`normalizedPath`) ↔ `NestRoute.fullPath`.
 */
export function nestRouteMatchesNormalizedPathCypher(refVar: string, nrVar: string): string {
  const np = `${refVar}.normalizedPath`;
  const fp = `${nrVar}.fullPath`;
  return [
    `${fp} = '/' + ${np}`,
    `${fp} = '/api/' + ${np}`,
    `(${fp} STARTS WITH '/' AND ${np} ENDS WITH substring(${fp}, 1))`,
    `(${fp} STARTS WITH '/api/' AND ${np} STARTS WITH substring(${fp}, 5))`,
    `(${refVar}.isDynamic = 'true' AND (${fp} = '/' + ${np} OR ${fp} STARTS WITH '/' + ${np} + '/' OR ${fp} STARTS WITH '/api/' + ${np} + '/'))`,
  ].join(' OR ');
}
