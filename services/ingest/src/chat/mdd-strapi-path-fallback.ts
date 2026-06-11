/**
 * Fallback MDD: infiere entidades/rutas Strapi leyendo schema.json y routes en evidence_paths
 * cuando Falkor no tiene nodos StrapiContentType/StrapiRoute (p. ej. projectId incorrecto en orchestrator).
 */
import type { MddEvidenceDocument } from './mdd-document.types';
import { parseStrapiSchemaJson } from '../pipeline/strapi-schema-extract';
import { parseStrapiRoutesFile } from '../pipeline/strapi-routes-extract';
import { matchStrapiSchemaJsonPath } from '../pipeline/strapi-path-patterns';

const SCHEMA_PATH_RE = /\/content-types\/[^/]+\/schema\.json$/i;
const ROUTES_PATH_RE = /\/(?:api|extensions)\/[^/]+\/routes\/[^/]+\.(json|js)$/i;

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
  const services = new Set<string>();

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
  }

  for (const p of params.evidencePaths) {
    if (apiByRoute.size >= params.maxRoutes) break;
    if (!ROUTES_PATH_RE.test(p)) continue;
    const content = await params.getFileSnippet(p);
    if (!content?.trim()) continue;
    const parsed = parseStrapiRoutesFile(p, content);
    if (!parsed) continue;
    for (const rt of parsed.routes) {
      if (!rt.path || !rt.method) continue;
      if (!apiByRoute.has(rt.path)) apiByRoute.set(rt.path, new Set());
      apiByRoute.get(rt.path)!.add(rt.method.toUpperCase());
    }
  }

  for (const p of params.evidencePaths) {
    const m = p.match(/\/api\/([^/]+)\/services\/([^/]+)\.(js|ts)$/i);
    if (m) services.add(`strapi:${m[2]}`);
  }

  const api_contracts: MddEvidenceDocument['api_contracts'] = [];
  for (const [route, methods] of apiByRoute) {
    api_contracts.push({ route, methods: [...methods], doc_source: 'strapi' });
  }

  const business_logic = [...services].slice(0, 200).map((service) => ({
    service,
    dependencies: [] as string[],
  }));

  const usedFallback = entities.length > 0 || api_contracts.length > 0 || business_logic.length > 0;
  return { entities, api_contracts, business_logic, usedFallback };
}
