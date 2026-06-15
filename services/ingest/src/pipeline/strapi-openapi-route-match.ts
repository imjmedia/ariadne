/**
 * Coincidencia de paths entre OpenApiOperation.pathTemplate y StrapiRoute.routePath.
 */
export function openApiPathMatchesStrapiRouteCypher(opVar: string, srVar: string): string {
  const pt = `${opVar}.pathTemplate`;
  const rp = `${srVar}.routePath`;
  return [
    `${pt} = ${rp}`,
    `${pt} = '/api' + ${rp}`,
    `(${pt} STARTS WITH '/api/' AND ${rp} = substring(${pt}, 4))`,
    `(${rp} STARTS WITH '/' AND ${pt} ENDS WITH substring(${rp}, 1))`,
  ].join(' OR ');
}
