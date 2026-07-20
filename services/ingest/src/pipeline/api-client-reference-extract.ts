/**
 * Referencias a rutas REST del backend en código frontend (`api/...`, `apiDirection=|:`, axiosQuery).
 * Soporta literales estáticos y prefijos dinámicos (`'api/users/' + id`).
 * Detecta APIs externas SSO/tasks (`tasks.imjmedia.com.mx`, `sso.imjmedia.com.mx`).
 */

/** Literales `'api/foo'`, `"api/bar"`, apiDirection="api/..." | apiDirection: 'api/...' */
const API_PATH_LITERAL_RE =
  /(?:apiDirection\s*[:=]\s*|(?:axiosQuery|queryApi)\s*\([^)]*['"]|['"`])(api\/[a-zA-Z0-9_\-/.:{}]+)['"`]/g;

const STANDALONE_API_LITERAL_RE = /['"`](api\/[a-zA-Z0-9_\-/.:{}]+)['"`]/g;

/** Nest/front típico: `api.get('/api/foo')`, fetch('/api/bar') */
const ABSOLUTE_API_LITERAL_RE =
  /(?:\.(?:get|post|put|patch|delete)\s*\(\s*|fetch\s*\(\s*)['"`](\/api\/[a-zA-Z0-9_\-/.:{}]+)['"`]/g;

const STANDALONE_SLASH_API_LITERAL_RE = /['"`](\/api\/[a-zA-Z0-9_\-/.:{}]+)['"`]/g;

/** `const BASE = "/api/provider-instances"` — cubre al menos el path base */
const CONST_BASE_API_RE = /const\s+[A-Z_][A-Z0-9_]*\s*=\s*['"`](\/api\/[a-zA-Z0-9_\-/.]+)['"`]/g;

/** Prefijo dinámico: `'api/users/' + id`, axiosQuery('PUT', 'api/cotizadores/' + x) */
const API_PATH_PREFIX_CONCAT_RE =
  /(?:apiDirection\s*[:=]\s*|(?:axiosQuery|queryApi)\s*\([^)]*['"]|['"`])(api\/[a-zA-Z0-9_\-/.]+)\/\s*['"`]\s*\+/g;

const API_PATH_PREFIX_NO_SLASH_RE =
  /(?:apiDirection\s*[:=]\s*|(?:axiosQuery|queryApi)\s*\([^)]*['"]|['"`])(api\/[a-zA-Z0-9_\-/.]+)['"`]\s*\+/g;

/** Template literal parcial: `api/medios/${id}` */
const API_PATH_TEMPLATE_RE = /`((?:api\/[a-zA-Z0-9_\-/.]+)\/\$\{[^}]+\}[^`]*)`/g;

/** `const path = 'api/foo'` / `let dir = "api/bar"` (bindings locales OBP). */
const CONST_API_BINDING_RE =
  /(?:const|let)\s+([A-Za-z_][\w]*)\s*=\s*['"`](api\/[a-zA-Z0-9_\-/.:{}]+)['"`]/g;

/** `apiDirection: someConst` / `apiDirection={someConst}` cuando someConst es binding local. */
const API_DIRECTION_IDENTIFIER_RE = /apiDirection\s*[:=]\s*\{?\s*([A-Za-z_][\w]*)\s*\}?/g;

const EXTERNAL_HOST_RE =
  /https:\/\/((?:tasks(?:dev)?|sso(?:dev)?)\.imjmedia\.com\.mx)\/?['"`]?\s*\)\s*\+\s*['"`](api\/[^'"`]+)['"`]/gi;

const EXTERNAL_FULL_URL_RE =
  /https:\/\/((?:tasks(?:dev)?|sso(?:dev)?)\.imjmedia\.com\.mx)\/(api\/[a-zA-Z0-9_\-/.]+)/gi;

export interface ApiClientReferenceParsed {
  apiPath: string;
  /** Segmento tras `api/` sin slash final, p. ej. `campanias`, `users-permissions/roles`. */
  normalizedPath: string;
  /** true si el path incluye segmento dinámico (concat o template). */
  isDynamic?: boolean;
}

export interface ExternalApiReferenceParsed {
  service: string;
  baseUrl: string;
  apiPath: string;
  normalizedPath: string;
  isDynamic?: boolean;
}

export function normalizeApiClientPath(apiPath: string): string {
  let p = apiPath.trim().replace(/\\/g, '/');
  if (p.startsWith('/')) p = p.slice(1);
  if (p.toLowerCase().startsWith('api/')) p = p.slice(4);
  while (p.endsWith('/')) p = p.slice(0, -1);
  p = p.replace(/\/\$\{[^}]+\}.*$/, '').replace(/\$\{[^}]+\}.*$/, '');
  return p;
}

function serviceFromHost(host: string): string {
  const h = host.toLowerCase();
  if (h.startsWith('tasksdev')) return 'tasks-dev';
  if (h.startsWith('tasks')) return 'tasks';
  if (h.startsWith('ssodev')) return 'sso-dev';
  if (h.startsWith('sso')) return 'sso';
  return h;
}

function normalizeRawApiPath(rawPath: string): string {
  let p = rawPath.trim().replace(/\\/g, '/');
  if (p.startsWith('/api/')) return `api/${p.slice(5)}`;
  if (p.startsWith('/')) p = p.slice(1);
  return p;
}

function pushApiRef(
  seen: Set<string>,
  out: ApiClientReferenceParsed[],
  rawPath: string,
  isDynamic = false,
): void {
  const apiPath = normalizeRawApiPath(rawPath);
  if (!apiPath || apiPath.length < 4 || !apiPath.startsWith('api/')) return;
  const key = `${apiPath}|${isDynamic ? 'd' : 's'}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    apiPath,
    normalizedPath: normalizeApiClientPath(apiPath),
    isDynamic,
  });
}

/** Bindings locales `const x = 'api/...'` usados luego como `apiDirection: x`. */
function resolveApiDirectionIdentifiers(
  source: string,
  seen: Set<string>,
  out: ApiClientReferenceParsed[],
): void {
  const bindings = new Map<string, string>();
  CONST_API_BINDING_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CONST_API_BINDING_RE.exec(source)) !== null) {
    bindings.set(m[1]!, m[2]!);
  }
  if (bindings.size === 0) return;

  API_DIRECTION_IDENTIFIER_RE.lastIndex = 0;
  while ((m = API_DIRECTION_IDENTIFIER_RE.exec(source)) !== null) {
    const id = m[1]!;
    const bound = bindings.get(id);
    if (bound) pushApiRef(seen, out, bound);
  }
}

/** Extrae paths `api/...` únicos del código fuente (TS/JS/TSX). */
export function extractApiClientReferences(source: string): ApiClientReferenceParsed[] {
  const seen = new Set<string>();
  const out: ApiClientReferenceParsed[] = [];

  const collect = (re: RegExp, isDynamic = false) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      pushApiRef(seen, out, m[1]!, isDynamic);
    }
  };

  collect(API_PATH_LITERAL_RE);
  collect(STANDALONE_API_LITERAL_RE);
  collect(ABSOLUTE_API_LITERAL_RE);
  collect(STANDALONE_SLASH_API_LITERAL_RE);
  collect(CONST_BASE_API_RE);
  collect(API_PATH_PREFIX_CONCAT_RE, true);
  collect(API_PATH_PREFIX_NO_SLASH_RE, true);
  collect(API_PATH_TEMPLATE_RE, true);
  resolveApiDirectionIdentifiers(source, seen, out);
  return out;
}

/** Referencias a APIs externas (SSO, tasks) fuera del ERP indexado. */
export function extractExternalApiReferences(source: string): ExternalApiReferenceParsed[] {
  const seen = new Set<string>();
  const out: ExternalApiReferenceParsed[] = [];

  const push = (host: string, apiPath: string, isDynamic = false) => {
    const baseUrl = `https://${host.replace(/\/$/, '')}/`;
    const key = `${baseUrl}|${apiPath}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      service: serviceFromHost(host),
      baseUrl,
      apiPath,
      normalizedPath: normalizeApiClientPath(apiPath),
      isDynamic,
    });
  };

  let m: RegExpExecArray | null;
  EXTERNAL_HOST_RE.lastIndex = 0;
  while ((m = EXTERNAL_HOST_RE.exec(source)) !== null) {
    push(m[1]!, m[2]!);
  }

  EXTERNAL_FULL_URL_RE.lastIndex = 0;
  while ((m = EXTERNAL_FULL_URL_RE.exec(source)) !== null) {
    push(m[1]!, m[2]!);
  }

  return out;
}
