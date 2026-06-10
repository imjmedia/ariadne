/**
 * Patrones de path Strapi v4 compartidos entre sync-path-filter, parser y extractores.
 */

export type StrapiSchemaPathMatch = {
  apiName: string;
  name: string;
  source: 'api' | 'extension';
};

/** `src/api/{api}/content-types/{name}/schema.json` o `src/extensions/{plugin}/content-types/{name}/schema.json`. */
export function matchStrapiSchemaJsonPath(path: string): StrapiSchemaPathMatch | null {
  const norm = path.replace(/\\/g, '/');
  const api = norm.match(/\/api\/([^/]+)\/content-types\/([^/]+)\/schema\.json$/i);
  if (api) return { apiName: api[1]!, name: api[2]!, source: 'api' };
  const ext = norm.match(/\/extensions\/([^/]+)\/content-types\/([^/]+)\/schema\.json$/i);
  if (ext) return { apiName: ext[1]!, name: ext[2]!, source: 'extension' };
  return null;
}

export type StrapiRoutesPathMatch = {
  apiName: string;
  source: 'api' | 'extension';
};

/** Rutas Strapi declaradas en JSON (sync walk). */
export function isStrapiRoutesJsonPath(path: string): boolean {
  const norm = path.replace(/\\/g, '/');
  if (/\/api\/[^/]+\/routes\/[^/]+\.json$/i.test(norm)) return true;
  if (/\/extensions\/[^/]+\/(?:server\/)?routes\/[^/]+\.json$/i.test(norm)) return true;
  if (/\/extensions\/[^/]+\/config\/routes\.json$/i.test(norm)) return true;
  if (/\/plugins\/[^/]+\/config\/routes\.json$/i.test(norm)) return true;
  return false;
}

/** Config Strapi en raíz del repo (`config/api.js`, `config/env/production/server.js`, …). */
export function isStrapiConfigJsPath(path: string): boolean {
  const norm = path.replace(/\\/g, '/');
  if (/^config\/[^/]+\.js$/i.test(norm)) return true;
  if (/^config\/env\/[^/]+\/[^/]+\.js$/i.test(norm)) return true;
  if (/^config\/[^/]+\/[^/]+\.js$/i.test(norm)) return true;
  return false;
}

/** Plugins locales Strapi (`src/plugins/**`). */
export function isStrapiPluginSyncPath(path: string): boolean {
  return /^src\/plugins\//i.test(path.replace(/\\/g, '/'));
}

/** Lifecycles de content-type Strapi v4. */
export function isStrapiLifecycleJsPath(path: string): boolean {
  const norm = path.replace(/\\/g, '/');
  return /\/(?:api|extensions)\/[^/]+\/content-types\/[^/]+\/lifecycles\.js$/i.test(norm);
}

/** Rutas Strapi en JS (`module.exports = { routes: [...] }`). */
export function matchStrapiRoutesJsPath(path: string): StrapiRoutesPathMatch | null {
  const norm = path.replace(/\\/g, '/');
  const api = norm.match(/\/api\/([^/]+)\/routes\/[^/]+\.js$/i);
  if (api) return { apiName: api[1]!, source: 'api' };
  return null;
}

/** GraphQL custom Strapi v4 (`src/api/{api}/config/schema.graphql`). */
export function isStrapiGraphqlSchemaPath(path: string): boolean {
  return /\/api\/[^/]+\/config\/schema\.graphql$/i.test(path.replace(/\\/g, '/'));
}

/** OpenAPI / Swagger indexables (incl. documentación generada por Strapi). */
export function isOpenApiSpecSyncPath(path: string): boolean {
  const norm = path.replace(/\\/g, '/');
  const base = norm.slice(norm.lastIndexOf('/') + 1).toLowerCase();
  if (base === 'swagger.json') return true;
  if (base === 'openapi.json') return true;
  if (base === 'openapi.yaml' || base === 'openapi.yml') return true;
  if (base === 'full_documentation.json') return true;
  if (/\/extensions\/[^/]+\/documentation\/[^/]+\/[^/]+\.json$/i.test(norm)) return true;
  if (/\/api\/[^/]+\/documentation\/[^/]+\/[^/]+\.json$/i.test(norm)) return true;
  return false;
}
