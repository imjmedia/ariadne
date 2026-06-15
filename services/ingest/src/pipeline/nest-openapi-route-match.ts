/**
 * Coincidencia de paths entre OpenApiOperation.pathTemplate y NestRoute.fullPath.
 */
export function openApiPathMatchesNestRouteCypher(opVar: string, nrVar: string): string {
  const pt = `${opVar}.pathTemplate`;
  const fp = `${nrVar}.fullPath`;
  return [
    `${pt} = ${fp}`,
    `${pt} = '/api' + ${fp}`,
    `(${pt} STARTS WITH '/api/' AND ${fp} = substring(${pt}, 5))`,
    `(${fp} STARTS WITH '/' AND ${pt} ENDS WITH substring(${fp}, 1))`,
    `(${pt} STARTS WITH '/api/' AND ${fp} STARTS WITH '/' AND substring(${pt}, 5) ENDS WITH substring(${fp}, 1))`,
  ].join(' OR ');
}
