/**
 * Fallback MDD: infiere entidades/rutas Strapi leyendo schema.json y routes en evidence_paths
 * cuando Falkor no tiene nodos StrapiContentType/StrapiRoute (p. ej. projectId incorrecto en orchestrator).
 */
import type { MddEvidenceDocument } from './mdd-document.types';
import { parseStrapiSchemaJson } from '../pipeline/strapi-schema-extract';
import { parseStrapiRoutesFile } from '../pipeline/strapi-routes-extract';
import {
  inferCoreRestRoutes,
  parseCreateCoreRouterUid,
  type StrapiUidMeta,
} from '../pipeline/strapi-core-router-infer';
import { matchStrapiRoutesJsPath, matchStrapiSchemaJsonPath } from '../pipeline/strapi-path-patterns';

const SCHEMA_PATH_RE = /\/content-types\/[^/]+\/schema\.json$/i;
const ROUTES_PATH_RE = /\/(?:api|extensions)\/[^/]+\/routes\/[^/]+\.(json|js)$/i;
const STRAPI_SERVICE_PATH_RE = /\/api\/[^/]+\/services\/(?:[^/]+\/)*([^/]+)\.(js|ts)$/i;

/** Servicios Strapi desde paths (sin leer disco); usable aunque entidades/rutas vengan del grafo. */
export function collectStrapiBusinessLogicFromEvidencePaths(
  evidencePaths: string[],
  maxServices: number,
): MddEvidenceDocument['business_logic'] {
  const byService = new Map<string, string[]>();
  for (const p of evidencePaths) {
    if (byService.size >= maxServices) break;
    const m = p.match(STRAPI_SERVICE_PATH_RE);
    if (!m) continue;
    const base = m[1]!.replace(/\.(js|ts)$/i, '');
    const key = `strapi:${base}`;
    const deps = byService.get(key) ?? [];
    if (!deps.includes(p)) deps.push(p);
    byService.set(key, deps);
  }
  return [...byService.entries()].slice(0, maxServices).map(([service, dependencies]) => ({
    service,
    dependencies,
  }));
}

function addRouteToMap(
  apiByRoute: Map<string, Set<string>>,
  routePath: string,
  method: string,
): void {
  if (!routePath || !method) return;
  const m = method.toUpperCase();
  if (!apiByRoute.has(routePath)) apiByRoute.set(routePath, new Set());
  apiByRoute.get(routePath)!.add(m);
}

export async function inferStrapiMddFromEvidencePaths(params: {
  evidencePaths: string[];
  getFileSnippet: (relPath: string) => Promise<string | null>;
  maxContentTypes: number;
  maxRoutes: number;
}): Promise<{
  entities: MddEvidenceDocument['entities'];
  api_contracts: MddEvidenceDocument['api_contracts'];
  business_logic: MddEvidenceDocument['business_logic'];
  usedFallback: boolean;
}> {
  const entities: MddEvidenceDocument['entities'] = [];
  const apiByRoute = new Map<string, Set<string>>();
  const uidMeta = new Map<string, StrapiUidMeta>();

  for (const p of params.evidencePaths) {
    if (entities.length >= params.maxContentTypes) break;
    if (!SCHEMA_PATH_RE.test(p)) continue;
    const content = await params.getFileSnippet(p);
    if (!content?.trim()) continue;
    const parsed = parseStrapiSchemaJson(p, content);
    if (!parsed) {
      const m = matchStrapiSchemaJsonPath(p);
      if (m) {
        entities.push({
          name: m.name,
          source: 'strapi',
          fields: [`uid:api::${m.apiName}.${m.name}`],
        });
      }
      continue;
    }
    const fields = parsed.attributesSummary
      ? parsed.attributesSummary.split(';').map((s) => s.trim()).filter(Boolean)
      : parsed.attributes.map((a) => a.name);
    if (parsed.strapiUid && !fields.some((f) => f.startsWith('uid:'))) {
      fields.unshift(`uid:${parsed.strapiUid}`);
    }
    entities.push({ name: parsed.name, source: 'strapi', fields });
    if (parsed.strapiUid && parsed.apiName) {
      uidMeta.set(parsed.strapiUid, {
        pluralName: parsed.pluralName ?? parsed.apiName,
        apiName: parsed.apiName,
        name: parsed.name,
      });
    }
  }

  for (const p of params.evidencePaths) {
    if (apiByRoute.size >= params.maxRoutes) break;
    if (!ROUTES_PATH_RE.test(p)) continue;
    const content = await params.getFileSnippet(p);
    if (!content?.trim()) continue;
    const jsMatch = matchStrapiRoutesJsPath(p);
    const coreUid = parseCreateCoreRouterUid(content);
    if (coreUid && jsMatch) {
      for (const rt of inferCoreRestRoutes(coreUid, uidMeta.get(coreUid), jsMatch.apiName)) {
        addRouteToMap(apiByRoute, rt.path, rt.method);
        if (apiByRoute.size >= params.maxRoutes) break;
      }
    }

    const parsed = parseStrapiRoutesFile(p, content);
    if (!parsed) continue;
    for (const rt of parsed.routes) {
      if (!rt.path || !rt.method) continue;
      addRouteToMap(apiByRoute, rt.path, rt.method);
      if (apiByRoute.size >= params.maxRoutes) break;
    }
  }

  const api_contracts: MddEvidenceDocument['api_contracts'] = [];
  for (const [route, methods] of apiByRoute) {
    api_contracts.push({ route, methods: [...methods], doc_source: 'strapi' });
  }

  const business_logic = collectStrapiBusinessLogicFromEvidencePaths(
    params.evidencePaths,
    200,
  );

  const usedFallback = entities.length > 0 || api_contracts.length > 0 || business_logic.length > 0;
  return { entities, api_contracts, business_logic, usedFallback };
}
