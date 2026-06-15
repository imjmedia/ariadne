/**
 * Clasificación de rutas React Router públicas (sin RequireAuth) que consumen APIs públicas del ERP.
 */

const PUBLIC_ENTRY_PATTERNS: RegExp[] = [
  /\/urbanos\/public/i,
  /visualizacionCampania/i,
  /visualizacion/i,
  /\/login\b/i,
];

/** Rutas front que representan entry points públicos (urbanos, link cliente, login). */
export function isPublicEntryRoute(path: string): boolean {
  const p = path.trim();
  if (!p) return false;
  return PUBLIC_ENTRY_PATTERNS.some((re) => re.test(p));
}

/** Hints de `StrapiRoute.apiName` asociados a un path React público. */
export function publicEntryStrapiApiHints(reactPath: string): string[] {
  const p = reactPath.toLowerCase();
  const hints = new Set<string>();
  if (p.includes('urbanos') || p.includes('/ruta')) {
    hints.add('ruta');
    hints.add('urbanos');
    hints.add('ruta-config');
    hints.add('lista-precio');
  }
  if (p.includes('visualizacion') || p.includes('campania')) {
    hints.add('campania');
    hints.add('detailpauta');
    hints.add('pauta');
    hints.add('cotizador');
    hints.add('lista-precio');
  }
  if (p.includes('login')) {
    hints.add('users-permissions');
  }
  return [...hints];
}

/** Predicado Cypher: `sr.apiName` coincide con hints del path React `rt.path`. */
export function publicEntryApiNameMatchCypher(rtVar: string, srVar: string): string {
  return `(
    (rt.path CONTAINS 'urbanos' OR rt.path CONTAINS '/ruta') AND (sr.apiName CONTAINS 'ruta' OR sr.apiName CONTAINS 'urbano' OR sr.apiName CONTAINS 'lista-precio')
    OR (rt.path CONTAINS 'visualizacion' OR rt.path CONTAINS 'Campania') AND (sr.apiName CONTAINS 'campania' OR sr.apiName CONTAINS 'pauta' OR sr.apiName CONTAINS 'detail' OR sr.apiName CONTAINS 'cotizador' OR sr.apiName CONTAINS 'lista-precio')
    OR rt.path CONTAINS 'login' AND sr.apiName CONTAINS 'users-permissions'
  )`;
}
