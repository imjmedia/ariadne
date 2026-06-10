/**
 * Parseo de rutas HTTP Strapi v4 desde routes.json o routes/*.js (custom routers).
 */
import {
  isStrapiRoutesJsonPath,
  matchStrapiRoutesJsPath,
  type StrapiRoutesPathMatch,
} from './strapi-path-patterns';

export interface StrapiRouteParsed {
  method: string;
  path: string;
  handler?: string;
  description?: string;
  apiName?: string;
  routeSource: 'json' | 'js' | 'core_router';
}

function normalizeMethod(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().toUpperCase();
}

function normalizeRoutePath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

function parseRouteEntry(raw: unknown, ctx: StrapiRoutesPathMatch, routeSource: 'json' | 'js'): StrapiRouteParsed | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const method = normalizeMethod(r.method);
  const routePath = normalizeRoutePath(r.path);
  if (!method || !routePath) return null;
  const handler = typeof r.handler === 'string' ? r.handler.trim() : undefined;
  const description = typeof r.description === 'string' ? r.description.trim() : undefined;
  return {
    method,
    path: routePath,
    handler,
    description,
    apiName: ctx.apiName,
    routeSource,
  };
}

function parseRoutesArray(arr: unknown, ctx: StrapiRoutesPathMatch, routeSource: 'json' | 'js'): StrapiRouteParsed[] {
  if (!Array.isArray(arr)) return [];
  const out: StrapiRouteParsed[] = [];
  for (const entry of arr) {
    const parsed = parseRouteEntry(entry, ctx, routeSource);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Extrae bloques `{ method, path, ... }` de routers Strapi en JS sin ejecutar el módulo. */
export function parseStrapiRoutesFromJsSource(source: string): StrapiRouteParsed[] {
  const routes: StrapiRouteParsed[] = [];
  const blockRe = /\{[^{}]*\}/g;
  for (const block of source.match(blockRe) ?? []) {
    if (!/method\s*:/.test(block) || !/path\s*:/.test(block)) continue;
    const method = block.match(/method\s*:\s*['"](\w+)['"]/i)?.[1];
    const routePath = block.match(/path\s*:\s*['"]([^'"]+)['"]/)?.[1];
    if (!method || !routePath) continue;
    const handler = block.match(/handler\s*:\s*['"]([^'"]+)['"]/)?.[1];
    const description = block.match(/description\s*:\s*['"]([^'"]*)['"]/)?.[1];
    routes.push({
      method: method.toUpperCase(),
      path: routePath,
      handler,
      description,
      routeSource: 'js',
    });
  }
  return routes;
}

export function parseStrapiRoutesFile(
  path: string,
  source: string,
): { routes: StrapiRouteParsed[]; apiName?: string } | null {
  const norm = path.replace(/\\/g, '/');

  if (isStrapiRoutesJsonPath(norm)) {
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(source) as Record<string, unknown>;
    } catch {
      return null;
    }
    const extPlugin = norm.match(/\/extensions\/([^/]+)\//i)?.[1];
    const pluginFolder = norm.match(/\/plugins\/([^/]+)\//i)?.[1];
    const apiFolder = norm.match(/\/api\/([^/]+)\//i)?.[1];
    const apiName = extPlugin ?? pluginFolder ?? apiFolder ?? 'unknown';
    const ctx: StrapiRoutesPathMatch = {
      apiName,
      source: extPlugin ? 'extension' : 'api',
    };
    return { routes: parseRoutesArray(doc.routes, ctx, 'json'), apiName };
  }

  const jsMatch = matchStrapiRoutesJsPath(norm);
  if (jsMatch) {
    const routes = parseStrapiRoutesFromJsSource(source).map((r) => ({
      ...r,
      apiName: jsMatch.apiName,
    }));
    return { routes, apiName: jsMatch.apiName };
  }

  return null;
}

/** Bloques markdown para el doc RAG de esquema relacional. */
export function formatStrapiRoutesForRag(entries: StrapiRouteParsed[]): string[] {
  const lines: string[] = [];
  lines.push('### Strapi (routes HTTP declaradas)');
  lines.push('');
  if (entries.length === 0) {
    lines.push('_(No hay rutas Strapi declaradas en routes.json/js en este snapshot.)_');
    lines.push('');
    return lines;
  }
  for (const r of entries.slice(0, 500)) {
    const api = r.apiName ? ` [${r.apiName}]` : '';
    const handler = r.handler ? ` handler \`${r.handler}\`` : '';
    const desc = r.description ? ` — ${r.description.replace(/\s+/g, ' ').slice(0, 120)}` : '';
    lines.push(`- \`${r.method} ${r.path}\`${api}${handler}${desc}`);
  }
  if (entries.length > 500) {
    lines.push(`- _… y ${entries.length - 500} rutas más_`);
  }
  lines.push('');
  return lines;
}
