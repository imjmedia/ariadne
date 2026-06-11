/**
 * Construye el JSON MDD de 7 secciones desde Falkor + archivos físicos (sin inventar paths).
 */
import type { MddEvidenceDocument } from './mdd-document.types';
import { getMddBuilderLimits } from './mdd-limits';
import { inferStrapiMddFromEvidencePaths } from './mdd-strapi-path-fallback';

function uniq(paths: string[]): string[] {
  return [...new Set(paths.filter((p) => typeof p === 'string' && p.length > 0))];
}

/** Acota consultas MDD al `repoId` del scope (multi-root / generate_legacy_documentation por repo). */
function cypherRepoScope(repoIds: string[] | undefined, nodeAlias: string): {
  clause: string;
  params: Record<string, unknown>;
} {
  if (!repoIds?.length) return { clause: '', params: {} };
  return { clause: ` AND ${nodeAlias}.repoId IN $repoIds`, params: { repoIds } };
}

function resolveMddRepoIds(params: { repoIds?: string[]; repositoryId?: string }): string[] | undefined {
  if (params.repoIds?.length) return [...new Set(params.repoIds.filter(Boolean))];
  if (params.repositoryId?.trim()) return [params.repositoryId.trim()];
  return undefined;
}

function pathsFromGathering(gatheredContext: string, collectedResults: unknown[]): string[] {
  const out: string[] = [];
  const blob = `${gatheredContext}\n${JSON.stringify(collectedResults)}`;
  const re = /\b[\w.-]+(?:\/[\w.-]+)+\.(?:prisma|tsx?|jsx?|json|ya?ml|md|mjs|cjs|env\.example)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    out.push(m[0]);
  }
  for (const r of collectedResults) {
    if (r && typeof r === 'object') {
      const o = r as Record<string, unknown>;
      const p = o.path ?? o.fnPath ?? o.file;
      if (typeof p === 'string') out.push(p);
    }
  }
  return uniq(out);
}

function inferOrmFromDeps(depKeys: string[]): string {
  const s = depKeys.join(' ').toLowerCase();
  if (s.includes('prisma') || s.includes('@prisma/client')) return 'prisma';
  if (s.includes('typeorm')) return 'typeorm';
  if (s.includes('sequelize')) return 'sequelize';
  if (s.includes('mongoose')) return 'mongoose';
  return depKeys.length ? 'unknown' : 'none';
}

function parseEnvExampleKeys(content: string): string[] {
  const keys: string[] = [];
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) keys.push(t.slice(0, eq).trim());
  }
  return keys.slice(0, 80);
}

/** Manifest agregado multi-repo: indica uso típico de Swagger en Nest. */
function inferSwaggerDependencies(depKeys: string[]): boolean {
  return depKeys.some((k) => {
    const l = k.toLowerCase();
    return l.includes('swagger') || l.includes('openapi');
  });
}

/** Inventarios / PRD que documentan endpoints aunque no haya OpenAPI indexado en el grafo. */
function pickSupplementaryApiDocPaths(paths: string[]): string[] {
  const hasStrapiBackendPaths = paths.some(
    (p) => p.includes('/content-types/') || /\/api\/[^/]+\/routes\//i.test(p),
  );
  const out: string[] = [];
  for (const p of paths) {
    const lower = p.toLowerCase();
    if (!lower.endsWith('.md') && !lower.endsWith('.mdx')) continue;
    if (
      !hasStrapiBackendPaths &&
      lower.includes('inventario') &&
      (lower.includes('erp') || lower.includes('endpoint'))
    ) {
      continue;
    }
    if (
      (lower.includes('inventario') && lower.includes('endpoint')) ||
      lower.includes('inventario-endpoint') ||
      lower.includes('endpoints.md') ||
      (lower.includes('/docs/') &&
        (lower.includes('api') || lower.includes('openapi') || lower.includes('endpoint'))) ||
      ((lower.includes('diseño') || lower.includes('diseno')) &&
        lower.includes('documentacion') &&
        lower.includes('api'))
    ) {
      out.push(p);
    }
  }
  return uniq(out);
}

function parseStrapiAttributesSummary(summary: string | null | undefined): string[] {
  if (!summary?.trim()) return [];
  return summary
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function groupRoutesByPath(
  rows: Array<{ route?: string; method?: string }>,
): Array<{ route: string; methods: string[]; doc_source: 'swagger' | 'ast' | 'strapi' }> {
  const byRoute = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.route || !row.method) continue;
    if (!byRoute.has(row.route)) byRoute.set(row.route, new Set());
    byRoute.get(row.route)!.add(String(row.method).toUpperCase());
  }
  const result: Array<{ route: string; methods: string[]; doc_source: 'swagger' | 'ast' | 'strapi' }> = [];
  for (const [route, methods] of byRoute) {
    result.push({ route, methods: [...methods], doc_source: 'swagger' });
  }
  return result;
}

function buildOpenApiSpecNotes(params: {
  openapiPath: string | null;
  swaggerDeps: boolean;
  swaggerRelatedPaths: string[];
  supplementaryDocs: string[];
  apiFromSwagger: number;
  apiFromAst: number;
  apiFromStrapi: number;
}): string | undefined {
  const {
    openapiPath,
    swaggerDeps,
    swaggerRelatedPaths,
    supplementaryDocs,
    apiFromSwagger,
    apiFromAst,
    apiFromStrapi,
  } = params;
  if (openapiPath) return undefined;
  const parts: string[] = [];
  if (swaggerDeps) {
    parts.push(
      'Dependencias swagger/openapi en package.json agregado del proyecto; la UI Swagger en runtime no implica archivo openapi.json/yml indexado en Falkor.',
    );
  }
  if (swaggerRelatedPaths.length > 0) {
    parts.push(
      `Archivos de configuración o rutas con "swagger"/"openapi" en el path (${swaggerRelatedPaths.length} en grafo).`,
    );
  }
  if (supplementaryDocs.length > 0) {
    parts.push(
      'Hay documentación Markdown que puede listar endpoints; no sustituye contrato OpenAPI en el índice.',
    );
  }
  if (
    apiFromSwagger === 0 &&
    apiFromAst === 0 &&
    apiFromStrapi === 0 &&
    (swaggerDeps || swaggerRelatedPaths.length > 0 || supplementaryDocs.length > 0)
  ) {
    parts.push(
      'Sin nodos OpenApiOperation, StrapiRoute ni NestController para este projectId: revisar sync del repo backend o ejecutar export OpenAPI y re-indexar el artefacto.',
    );
  }
  return parts.length ? parts.join(' ') : undefined;
}

export async function buildMddEvidenceDocument(params: {
  projectId: string;
  /** Acota nodos Falkor al repo del scope MCP (evita mezclar roots en multi-root). */
  repoIds?: string[];
  repositoryId?: string;
  message: string;
  gatheredContext: string;
  collectedResults: unknown[];
  executeCypher: (
    projectId: string,
    cypher: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown[]>;
  getFileSnippet: (relPath: string) => Promise<string | null>;
}): Promise<MddEvidenceDocument> {
  const { projectId, message, gatheredContext, collectedResults, executeCypher, getFileSnippet } =
    params;
  const scopedRepoIds = resolveMddRepoIds(params);
  const L = getMddBuilderLimits();

  // ── Phase 1: All independent Cypher queries + file reads in parallel ──────────
  const [
    manifestDepKeys,
    openapiPath,
    swaggerRelatedPaths,
    apiFromSwagger,
    apiFromAst,
    apiFromStrapi,
    entitiesFromModels,
    entitiesFromStrapi,
    business,
    envContent,
  ] = await Promise.all([
    // 1. manifestDepKeys
    (async (): Promise<string[]> => {
      try {
        const rows = (await executeCypher(
          projectId,
          `MATCH (p:Project {projectId: $projectId}) RETURN p.manifestDeps AS m LIMIT 1`,
          { projectId },
        )) as Array<{ m?: string | null }>;
        const raw = rows[0]?.m;
        if (typeof raw === 'string' && raw.trim()) {
          const j = JSON.parse(raw) as string[] | { depKeys?: string[]; scripts?: Record<string, string> };
          return Array.isArray(j) ? j : j.depKeys ?? [];
        }
      } catch {
        /* ignore */
      }
      return [];
    })(),

    // 2. openapiPath
    (async (): Promise<string | null> => {
      try {
        const rs = cypherRepoScope(scopedRepoIds, 'f');
        const oa = (await executeCypher(
          projectId,
          `MATCH (f:File {projectId: $projectId}) WHERE f.openApiTruth = true${rs.clause} RETURN f.path AS path LIMIT ${L.openApiFileCandidates}`,
          { projectId, ...rs.params },
        )) as Array<{ path?: string }>;
        return oa[0]?.path ?? null;
      } catch {
        /* ignore */
      }
      return null;
    })(),

    // 3. swaggerRelatedPaths
    (async (): Promise<string[]> => {
      try {
        const rs = cypherRepoScope(scopedRepoIds, 'f');
        const sw = (await executeCypher(
          projectId,
          `MATCH (f:File {projectId: $projectId})
           WHERE (toLower(f.path) CONTAINS 'swagger'
              OR toLower(f.path) CONTAINS 'openapi')${rs.clause}
           RETURN f.path AS path LIMIT ${L.swaggerRelatedFiles}`,
          { projectId, ...rs.params },
        )) as Array<{ path?: string }>;
        return uniq(
          sw.map((r) => r.path).filter((p): p is string => typeof p === 'string' && p.length > 0),
        );
      } catch {
        /* ignore */
      }
      return [];
    })(),

    // 4. apiFromSwagger (OpenApiOperation nodes)
    (async (): Promise<
      Array<{ route: string; methods: string[]; doc_source: 'swagger' | 'ast' }>
    > => {
      try {
        const rs = cypherRepoScope(scopedRepoIds, 'op');
        const ops = (await executeCypher(
          projectId,
          `MATCH (op:OpenApiOperation {projectId: $projectId})${rs.clause}
           RETURN op.pathTemplate AS route, op.method AS method LIMIT ${L.openApiOperations}`,
          { projectId, ...rs.params },
        )) as Array<{ route?: string; method?: string }>;
        return groupRoutesByPath(ops).map((r) => ({ ...r, doc_source: 'swagger' as const }));
      } catch {
        /* grafo sin OpenApiOperation */
      }
      return [];
    })(),

    // 5. apiFromAst (NestController nodes) — run unconditionally in parallel
    (async (): Promise<
      Array<{ route: string; methods: string[]; doc_source: 'swagger' | 'ast' }>
    > => {
      try {
        const rs = cypherRepoScope(scopedRepoIds, 'c');
        const ctr = (await executeCypher(
          projectId,
          `MATCH (c:NestController {projectId: $projectId})${rs.clause}
           RETURN coalesce(c.route,'') AS prefix, c.name AS name LIMIT ${L.nestControllers}`,
          { projectId, ...rs.params },
        )) as Array<{ prefix?: string | null; name?: string }>;
        const result: Array<{ route: string; methods: string[]; doc_source: 'swagger' | 'ast' }> = [];
        for (const row of ctr) {
          const base = (row.prefix ?? '').replace(/^\/|\/$/g, '');
          const route = base ? `/${base}` : '/';
          result.push({ route, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], doc_source: 'ast' });
        }
        return result;
      } catch {
        /* ignore */
      }
      return [];
    })(),

    // 5b. apiFromStrapi (StrapiRoute nodes)
    (async (): Promise<
      Array<{ route: string; methods: string[]; doc_source: 'swagger' | 'ast' | 'strapi' }>
    > => {
      try {
        const rs = cypherRepoScope(scopedRepoIds, 'sr');
        const routes = (await executeCypher(
          projectId,
          `MATCH (sr:StrapiRoute {projectId: $projectId})${rs.clause}
           RETURN sr.routePath AS route, sr.method AS method LIMIT ${L.strapiRoutes}`,
          { projectId, ...rs.params },
        )) as Array<{ route?: string; method?: string }>;
        return groupRoutesByPath(routes).map((r) => ({ ...r, doc_source: 'strapi' as const }));
      } catch {
        /* grafo sin StrapiRoute */
      }
      return [];
    })(),

    // 6. entitiesFromModels (Model nodes)
    (async (): Promise<MddEvidenceDocument['entities']> => {
      try {
        const rs = cypherRepoScope(scopedRepoIds, 'm');
        const models = (await executeCypher(
          projectId,
          `MATCH (m:Model {projectId: $projectId})${rs.clause}
           RETURN m.name AS name, m.source AS source, m.fieldSummary AS fs LIMIT ${L.models}`,
          { projectId, ...rs.params },
        )) as Array<{ name?: string; source?: string; fs?: string | null }>;
        const result: MddEvidenceDocument['entities'] = [];
        for (const row of models) {
          if (!row.name) continue;
          if (row.source !== 'prisma' && row.source !== 'typeorm' && !row.fs) continue;
          const source = row.source === 'typeorm' ? 'typeorm' : 'prisma';
          let fields: string[] = [];
          if (row.fs) {
            try {
              fields = JSON.parse(row.fs) as string[];
            } catch {
              fields = [];
            }
          }
          result.push({ name: row.name, source, fields });
        }
        return result;
      } catch {
        /* ignore */
      }
      return [];
    })(),

    // 6b. entitiesFromStrapi (StrapiContentType nodes)
    (async (): Promise<MddEvidenceDocument['entities']> => {
      try {
        const rs = cypherRepoScope(scopedRepoIds, 'ct');
        const rows = (await executeCypher(
          projectId,
          `MATCH (ct:StrapiContentType {projectId: $projectId})${rs.clause}
           RETURN ct.name AS name, ct.attributesSummary AS fs, ct.strapiUid AS uid LIMIT ${L.strapiContentTypes}`,
          { projectId, ...rs.params },
        )) as Array<{ name?: string; fs?: string | null; uid?: string | null }>;
        const result: MddEvidenceDocument['entities'] = [];
        for (const row of rows) {
          if (!row.name) continue;
          const fields = parseStrapiAttributesSummary(row.fs);
          if (row.uid?.trim() && !fields.some((f) => f.startsWith('uid:'))) {
            fields.unshift(`uid:${row.uid.trim()}`);
          }
          result.push({ name: row.name, source: 'strapi', fields });
        }
        return result;
      } catch {
        /* ignore */
      }
      return [];
    })(),

    // 7. business (NestService + StrapiService nodes)
    (async (): Promise<MddEvidenceDocument['business_logic']> => {
      const result: MddEvidenceDocument['business_logic'] = [];
      try {
        const rs = cypherRepoScope(scopedRepoIds, 's');
        const svcs = (await executeCypher(
          projectId,
          `MATCH (f:File)-[:CONTAINS]->(s:NestService {projectId: $projectId})${rs.clause}
           RETURN s.name AS service, f.path AS path LIMIT ${L.nestServices}`,
          { projectId, ...rs.params },
        )) as Array<{ service?: string; path?: string }>;
        for (const row of svcs) {
          if (row.service)
            result.push({ service: row.service, dependencies: row.path ? [row.path] : [] });
        }
      } catch {
        /* ignore */
      }
      try {
        const rs = cypherRepoScope(scopedRepoIds, 's');
        const strapiSvcs = (await executeCypher(
          projectId,
          `MATCH (f:File)-[:CONTAINS]->(s:StrapiService {projectId: $projectId})${rs.clause}
           RETURN s.name AS service, f.path AS path LIMIT ${L.nestServices}`,
          { projectId, ...rs.params },
        )) as Array<{ service?: string; path?: string }>;
        for (const row of strapiSvcs) {
          if (row.service)
            result.push({ service: `strapi:${row.service}`, dependencies: row.path ? [row.path] : [] });
        }
      } catch {
        /* grafo sin StrapiService */
      }
      return result;
    })(),

    // 8. envContent — read once, shared between envVars extraction and physicalPriority
    (async (): Promise<string | null> => {
      try {
        return await getFileSnippet('.env.example');
      } catch {
        return null;
      }
    })(),
  ]);

  // ── Phase 2: Build the MDD object from parallel results ──────────────────────

  const entities = [...entitiesFromModels, ...entitiesFromStrapi];

  // envVars from cached envContent
  const envVars: string[] = envContent ? parseEnvExampleKeys(envContent) : [];

  // evidence paths from gathered context + collected results
  let evidence_paths = pathsFromGathering(gatheredContext, collectedResults);

  // physicalPriority files — reuse cached .env.example to avoid a second read
  const physicalPriority = [
    'package.json',
    'schema.prisma',
    'prisma/schema.prisma',
    'swagger.json',
    'openapi.yaml',
    'openapi.yml',
    'tsconfig.json',
    '.env.example',
  ];
  for (const p of physicalPriority) {
    // Reuse the already-fetched .env.example content
    const c = p === '.env.example' ? envContent : await getFileSnippet(p);
    if (c && c.length > 0 && !evidence_paths.includes(p)) evidence_paths.push(p);
  }

  const mergedEvidencePaths = uniq(evidence_paths);

  let entitiesFinal = entities;
  let apiFromStrapiFinal = apiFromStrapi;
  let businessFinal = business;
  let usedPathFallback = false;

  const hasStrapiEvidencePaths = mergedEvidencePaths.some(
    (p) => /\/content-types\/[^/]+\/schema\.json$/i.test(p) || /\/(?:api|extensions)\/[^/]+\/routes\//i.test(p),
  );
  if (
    entitiesFromStrapi.length === 0 &&
    apiFromStrapi.length === 0 &&
    hasStrapiEvidencePaths
  ) {
    const fb = await inferStrapiMddFromEvidencePaths({
      evidencePaths: mergedEvidencePaths,
      getFileSnippet,
      maxContentTypes: L.strapiContentTypes,
      maxRoutes: L.strapiRoutes,
    });
    if (fb.usedFallback) {
      usedPathFallback = true;
      if (entitiesFinal.length === 0 && fb.entities.length > 0) entitiesFinal = fb.entities;
      if (apiFromStrapiFinal.length === 0 && fb.api_contracts.length > 0) {
        apiFromStrapiFinal = fb.api_contracts;
      }
      if (businessFinal.length === 0 && fb.business_logic.length > 0) {
        businessFinal = fb.business_logic;
      }
    }
  }

  const supplementaryDocPaths = pickSupplementaryApiDocPaths(mergedEvidencePaths);
  const swaggerDeps = inferSwaggerDependencies(manifestDepKeys);

  // Decide which API contracts to use: OpenAPI > Strapi routes > Nest AST
  const api_contracts = apiFromSwagger.length
    ? apiFromSwagger
    : apiFromStrapiFinal.length
      ? apiFromStrapiFinal
      : apiFromAst;

  const trust: MddEvidenceDocument['openapi_spec']['trust_level'] =
    openapiPath && apiFromSwagger.length ? 'high' : openapiPath ? 'medium' : 'low';

  const summaryParts = [
    `Consulta: ${message.slice(0, L.summaryMessageChars)}`,
    `Evidencia anclada a ${mergedEvidencePaths.length} ruta(s) verificada(s) en el repositorio indexado.`,
    openapiPath ? `Contrato OpenAPI priorizado: \`${openapiPath}\`.` : 'Sin spec OpenAPI indexado; rutas vía AST si aplica.',
    entitiesFinal.length
      ? usedPathFallback && entitiesFromStrapi.length === 0
        ? `${entitiesFinal.length} entidad(es) Strapi inferida(s) desde schema.json en evidence_paths (grafo vacío).`
        : `${entitiesFinal.length} entidad(es) en grafo (${entitiesFromModels.length} ORM, ${entitiesFromStrapi.length} Strapi).`
      : 'Sin nodos Model ni StrapiContentType en grafo para este alcance.',
  ];
  if (!openapiPath && (swaggerDeps || swaggerRelatedPaths.length > 0)) {
    summaryParts.push(
      'Swagger/OpenAPI en dependencias o rutas de archivo detectado(s) sin artefacto OpenAPI indexado como File.openApiTruth.',
    );
  }
  if (supplementaryDocPaths.length > 0) {
    summaryParts.push(
      `Documentación de endpoints en Markdown (evidencia): ${supplementaryDocPaths
        .slice(0, 5)
        .map((p) => `\`${p}\``)
        .join(', ')}${supplementaryDocPaths.length > 5 ? '…' : ''}.`,
    );
  }
  if (apiFromStrapiFinal.length > 0 && apiFromSwagger.length === 0) {
    summaryParts.push(
      usedPathFallback && apiFromStrapi.length === 0
        ? `${apiFromStrapiFinal.length} contrato(s) API inferido(s) desde routes en evidence_paths (grafo vacío).`
        : `${apiFromStrapiFinal.length} contrato(s) API desde StrapiRoute (routes.json / core router).`,
    );
  }
  const summary = summaryParts.join(' ');

  const complexity = Math.min(
    100,
    Math.round(
      entitiesFinal.length * 2 +
        apiFromSwagger.length +
        apiFromStrapiFinal.length +
        apiFromAst.length +
        businessFinal.length +
        mergedEvidencePaths.length * 0.5,
    ),
  );

  const openApiNotes = buildOpenApiSpecNotes({
    openapiPath,
    swaggerDeps,
    swaggerRelatedPaths,
    supplementaryDocs: supplementaryDocPaths,
    apiFromSwagger: apiFromSwagger.length,
    apiFromAst: apiFromAst.length,
    apiFromStrapi: apiFromStrapiFinal.length,
  });

  return {
    summary,
    openapi_spec: {
      found: Boolean(openapiPath),
      path: openapiPath,
      trust_level: trust,
      ...(swaggerDeps ? { swagger_dependencies: true } : {}),
      ...(swaggerRelatedPaths.length > 0 ? { swagger_related_paths: swaggerRelatedPaths } : {}),
      ...(supplementaryDocPaths.length > 0 ? { supplementary_doc_paths: supplementaryDocPaths } : {}),
      ...(openApiNotes ? { notes: openApiNotes } : {}),
    },
    entities: entitiesFinal,
    api_contracts,
    business_logic: businessFinal,
    infrastructure: {
      orm: inferOrmFromDeps(manifestDepKeys),
      env_vars: envVars,
    },
    risk_report: {
      complexity,
      anti_patterns:
        apiFromSwagger.length === 0 && apiFromAst.length === 0 && apiFromStrapiFinal.length > 200
          ? ['strapi_route_large_surface']
          : apiFromSwagger.length === 0 && apiFromAst.length > 50
            ? ['ast_fallback_large_surface']
            : [],
    },
    evidence_paths: mergedEvidencePaths.slice(0, L.evidencePaths),
  };
}
