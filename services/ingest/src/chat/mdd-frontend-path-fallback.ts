/**
 * Fallback MDD frontend (React/Vite): infiere entidades desde src/Models y contratos desde src/api + apiDirection.
 */
import type { MddEvidenceDocument } from './mdd-document.types';

const MODEL_PATH_RE = /\/(?:Models|modelsType)\/[^/]+\.(tsx?|ts)$/i;
/** Cliente OBP: src/api/*.tsx y src/api/queries/*.tsx (excluye árbol Strapi controllers/services/routes). */
const FRONTEND_API_MODULE_PATH_RE = /\/api\/(?:queries\/)?[^/]+\.(tsx?|ts)$/i;
const STRAPI_API_TREE_RE = /\/api\/[^/]+\/(content-types|controllers|routes|services)\//i;
const API_DIRECTION_RE = /apiDirection\s*:\s*['"](api\/[^'"]+)['"]/gi;
const API_MENTION_RE = /(?:\(\s*|`|\b)(api\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)?)\b/gi;
const METHOD_NEAR_API_RE =
  /method\s*:\s*['"](GET|POST|PUT|PATCH|DELETE)['"][\s\S]{0,400}?apiDirection\s*:\s*['"](api\/[^'"]+)['"]/gi;

export function isFrontendApiModulePath(path: string): boolean {
  const norm = path.replace(/\\/g, '/');
  if (STRAPI_API_TREE_RE.test(norm)) return false;
  return FRONTEND_API_MODULE_PATH_RE.test(norm);
}

export function isFrontendEvidencePath(path: string): boolean {
  return MODEL_PATH_RE.test(path) || isFrontendApiModulePath(path);
}

export function frontendApiModuleServiceName(path: string): string | null {
  if (!isFrontendApiModulePath(path)) return null;
  const base = path.split('/').pop()?.replace(/\.(tsx?|ts)$/, '');
  return base ? `frontend:${base}` : null;
}

/** Módulos src/api desde paths (sin leer disco). */
export function collectFrontendBusinessLogicFromEvidencePaths(
  evidencePaths: string[],
  maxModules: number,
): MddEvidenceDocument['business_logic'] {
  const byService = new Map<string, string[]>();
  for (const p of evidencePaths) {
    if (byService.size >= maxModules) break;
    const name = frontendApiModuleServiceName(p);
    if (!name) continue;
    const deps = byService.get(name) ?? [];
    if (!deps.includes(p)) deps.push(p);
    byService.set(name, deps);
  }
  return [...byService.entries()].slice(0, maxModules).map(([service, dependencies]) => ({
    service,
    dependencies,
  }));
}

function extractBalancedBlock(source: string, openBraceIdx: number): string | null {
  if (source[openBraceIdx] !== '{') return null;
  let depth = 0;
  for (let i = openBraceIdx; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openBraceIdx, i + 1);
    }
  }
  return null;
}

function parseInterfaceFields(body: string): string[] {
  const fields: string[] = [];
  const fieldRe = /^\s*(\w+)\??\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(body)) !== null) {
    fields.push(m[1]!);
  }
  return fields.slice(0, 40);
}

function parseModelEntitiesFromSource(path: string, content: string): MddEvidenceDocument['entities'] {
  const entities: MddEvidenceDocument['entities'] = [];
  const ifaceRe = /export\s+interface\s+(\w+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = ifaceRe.exec(content)) !== null) {
    const name = m[1]!;
    const block = extractBalancedBlock(content, m.index + m[0].length - 1);
    if (!block) continue;
    const inner = block.slice(1, -1);
    const fields = parseInterfaceFields(inner);
    if (fields.length === 0) continue;
    entities.push({
      name,
      source: 'frontend',
      fields: [`path:${path}`, ...fields],
    });
  }
  return entities;
}

function normalizeApiRoute(apiPath: string): string {
  const trimmed = apiPath.trim().replace(/^\/+/, '');
  return trimmed.startsWith('api/') ? `/${trimmed}` : `/api/${trimmed}`;
}

function collectApiContractsFromSource(content: string): Map<string, Set<string>> {
  const byRoute = new Map<string, Set<string>>();

  const add = (rawPath: string, method: string) => {
    const route = normalizeApiRoute(rawPath);
    const m = method.toUpperCase();
    if (!byRoute.has(route)) byRoute.set(route, new Set());
    byRoute.get(route)!.add(m);
  };

  let m: RegExpExecArray | null;
  METHOD_NEAR_API_RE.lastIndex = 0;
  while ((m = METHOD_NEAR_API_RE.exec(content)) !== null) {
    add(m[2]!, m[1]!);
  }

  API_DIRECTION_RE.lastIndex = 0;
  while ((m = API_DIRECTION_RE.exec(content)) !== null) {
    add(m[1]!, 'GET');
  }

  API_MENTION_RE.lastIndex = 0;
  while ((m = API_MENTION_RE.exec(content)) !== null) {
    const p = m[1]!;
    if (p.includes('search-') || p.split('/').length <= 3) {
      add(p, p.includes('search-') ? 'POST' : 'GET');
    }
  }

  return byRoute;
}

export async function inferFrontendMddFromEvidencePaths(params: {
  evidencePaths: string[];
  getFileSnippet: (relPath: string) => Promise<string | null>;
  maxEntities: number;
  maxRoutes: number;
  maxModules?: number;
}): Promise<{
  entities: MddEvidenceDocument['entities'];
  api_contracts: MddEvidenceDocument['api_contracts'];
  business_logic: MddEvidenceDocument['business_logic'];
  usedFallback: boolean;
}> {
  const entities: MddEvidenceDocument['entities'] = [];
  const apiByRoute = new Map<string, Set<string>>();
  const maxModules = params.maxModules ?? 200;

  for (const p of params.evidencePaths) {
    if (entities.length >= params.maxEntities) break;
    if (!MODEL_PATH_RE.test(p)) continue;
    const content = await params.getFileSnippet(p);
    if (!content?.trim()) continue;
    for (const e of parseModelEntitiesFromSource(p, content)) {
      if (entities.length >= params.maxEntities) break;
      entities.push(e);
    }
  }

  for (const p of params.evidencePaths) {
    if (apiByRoute.size >= params.maxRoutes) break;
    if (!isFrontendApiModulePath(p)) continue;
    const content = await params.getFileSnippet(p);
    if (!content?.trim()) continue;
    for (const [route, methods] of collectApiContractsFromSource(content)) {
      if (!apiByRoute.has(route)) apiByRoute.set(route, new Set());
      for (const method of methods) apiByRoute.get(route)!.add(method);
      if (apiByRoute.size >= params.maxRoutes) break;
    }
  }

  const api_contracts: MddEvidenceDocument['api_contracts'] = [];
  for (const [route, methods] of apiByRoute) {
    api_contracts.push({ route, methods: [...methods], doc_source: 'ast' });
  }

  const business_logic = collectFrontendBusinessLogicFromEvidencePaths(
    params.evidencePaths,
    maxModules,
  );

  const usedFallback = entities.length > 0 || api_contracts.length > 0 || business_logic.length > 0;
  return { entities, api_contracts, business_logic, usedFallback };
}
