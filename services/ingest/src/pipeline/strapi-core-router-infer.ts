/**
 * Infiere rutas REST estándar de Strapi v4 desde createCoreRouter('api::foo.bar').
 */
import type { ParsedFile } from './parser';
import { matchStrapiRoutesJsPath } from './strapi-path-patterns';
import type { StrapiRouteParsed } from './strapi-routes-extract';

export type StrapiUidMeta = {
  pluralName: string;
  apiName: string;
  name: string;
};

/** Mapa uid → metadatos desde schemas parseados en el mismo sync. */
export function buildStrapiUidMetaMap(parsedFiles: readonly ParsedFile[]): Map<string, StrapiUidMeta> {
  const map = new Map<string, StrapiUidMeta>();
  for (const pf of parsedFiles) {
    for (const ct of pf.strapiContentTypes ?? []) {
      if (!ct.apiName || !ct.strapiUid) continue;
      map.set(ct.strapiUid, {
        pluralName: ct.pluralName ?? ct.apiName,
        apiName: ct.apiName,
        name: ct.name,
      });
    }
  }
  return map;
}

export function parseCreateCoreRouterUid(source: string): string | null {
  const m = source.match(/createCoreRouter\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  return m?.[1]?.trim() ?? null;
}

/** Rutas REST core de Strapi (find/findOne/create/update/delete). */
export function inferCoreRestRoutes(
  uid: string,
  meta: StrapiUidMeta | undefined,
  apiName: string,
): StrapiRouteParsed[] {
  const parts = uid.split('.');
  const fallbackPlural = parts[parts.length - 1] ?? apiName;
  const plural = meta?.pluralName ?? fallbackPlural;
  const base = `/${plural}`;
  const handlerPrefix = apiName;
  const mk = (method: string, routePath: string, handler: string): StrapiRouteParsed => ({
    method,
    path: routePath,
    handler: `${handlerPrefix}.${handler}`,
    apiName,
    routeSource: 'core_router',
    description: `Strapi core REST (${uid})`,
  });
  return [
    mk('GET', base, 'find'),
    mk('GET', `${base}/{id}`, 'findOne'),
    mk('POST', base, 'create'),
    mk('PUT', `${base}/{id}`, 'update'),
    mk('DELETE', `${base}/{id}`, 'delete'),
  ];
}

/**
 * Añade rutas inferidas a archivos `routes/*.js` que solo exportan createCoreRouter.
 */
export async function enrichParsedFilesWithCoreRouterRoutes(
  parsedByPath: Map<string, ParsedFile>,
  getContent: (relPath: string) => Promise<string | null>,
  parsedFiles: readonly ParsedFile[],
): Promise<void> {
  const uidMeta = buildStrapiUidMetaMap(parsedFiles);

  for (const [relPath, parsed] of parsedByPath) {
    const jsMatch = matchStrapiRoutesJsPath(relPath);
    if (!jsMatch) continue;
    if ((parsed.strapiRoutes?.length ?? 0) > 0) continue;

    const source = await getContent(relPath);
    if (!source) continue;
    const uid = parseCreateCoreRouterUid(source);
    if (!uid) continue;

    const routes = inferCoreRestRoutes(uid, uidMeta.get(uid), jsMatch.apiName);
    parsed.strapiRoutes = [...(parsed.strapiRoutes ?? []), ...routes];
  }
}
