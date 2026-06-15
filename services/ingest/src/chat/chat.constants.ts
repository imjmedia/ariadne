/**
 * Constantes y configuración del chat NL→Cypher (schema, ejemplos, límites, tools).
 */

export const SCHEMA = `
Grafo FalkorDB (Cypher). Nodos:
- File {path, projectId, repoId, openApiTruth?, fileRole? (tsconfig|env_example|strapi_config|strapi_plugin), specKind?}
- Component {name, projectId, repoId}
- Function {path, name, projectId, repoId, complexity, nestingDepth, loc, description}
- Model {path, name, projectId, repoId, source (prisma|typeorm), fieldSummary?}
- OpenApiOperation {pathTemplate, method, specPath, projectId, repoId, docSource}
- StrapiContentType {path, name, projectId, repoId, apiName, strapiUid, attributesSummary, displayName, collectionName}
- StrapiController, StrapiService {path, name, projectId, repoId, apiName?}
- StrapiRoute {path, method, routePath, projectId, repoId, handler?, apiName?, routeSource? (json|js|core_router), publicRoute?, implicitConsumer? (strapi_admin)}
- StrapiUidReference {uid, filePath, projectId, repoId, apiName?} — lifecycles/cron con strapi.service/controller
- ApiClientReference {apiPath, normalizedPath, filePath, projectId, repoId, isDynamic?}
- ExternalApiReference {service, baseUrl, apiPath, normalizedPath, filePath, projectId, repoId, isDynamic?} — SSO/tasks fuera del ERP
- GraphQlClientReference {operationName, rootField, filePath, projectId, repoId} — gql/graphql en front
- GraphQlQuery {path, name, operationKind (query|mutation), apiName, description?, resolverOf?, resolverAction?}
- Route {path, projectId, repoId, componentName} — React Router (front)
- Hook {name, projectId, repoId}
- DomainConcept {name, projectId, repoId, category, sourcePath, options?, description?}
- NestController, NestService, NestModule, NestRoute, NestGuard {path, name, projectId, repoId}

Relaciones:
- (File)-[:CONTAINS]->(Component|Function|StrapiContentType|StrapiRoute|…)
- (File)-[:DEFINES_OP]->(OpenApiOperation)
- (File)-[:REFERENCES_API]->(ApiClientReference)
- (File)-[:REFERENCES_EXTERNAL_API]->(ExternalApiReference)
- (File)-[:CONTAINS]->(GraphQlQuery)
- (File)-[:REFERENCES_GRAPHQL]->(GraphQlClientReference)
- (ApiClientReference)-[:CALLS_API]->(OpenApiOperation) — multi-repo front→back
- (OpenApiOperation)-[:SAME_REST_AS]->(StrapiRoute) — OpenAPI spec ↔ rutas Strapi (mismo repo)
- (ApiClientReference)-[:CALLS_STRAPI_ROUTE]->(StrapiRoute) — multi-repo front→Strapi custom/core routes
- (ExternalApiReference)-[:CALLS_STRAPI_ROUTE]->(StrapiRoute) — Tasks/SSO→Strapi
- (File)-[:INVOKES_STRAPI_ROUTE]->(StrapiRoute) — lifecycle/cron en ERP
- (File)-[:REFERENCES_STRAPI_UID]->(StrapiUidReference)
- (GraphQlQuery)-[:RESOLVES_TO_ROUTE]->(StrapiRoute) — GraphQL custom → handler REST
- (GraphQlClientReference)-[:CALLS_GRAPHQL_QUERY]->(GraphQlQuery)
- (GraphQlClientReference)-[:CALLS_STRAPI_ROUTE]->(StrapiRoute) — GraphQL front→REST
- (StrapiContentType)-[:RELATES_TO {attribute, relation}]->(StrapiContentType) — relaciones schema.json
- (File)-[:LIFECYCLE_OF]->(StrapiContentType) — lifecycles.js del content-type
- (File)-[:IMPORTS]->(File), (Component)-[:RENDERS]->(Component), (Function)-[:CALLS]->(Function)

IMPORTANTE: Toda consulta debe filtrar con projectId = $projectId (y repoId = $repoId en multi-root). FalkorDB NO tiene toLower: usa CONTAINS con la palabra exacta o prueba variantes.
`;

export const EXAMPLES = `
Ejemplos que funcionan:

Pregunta: "archivos que contienen login"
\`\`\`cypher
MATCH (f:File) WHERE f.projectId = $projectId AND (f.path CONTAINS 'login' OR f.path CONTAINS 'Login') RETURN f.path as path
\`\`\`

Pregunta: "componentes y archivos relacionados con login"
\`\`\`cypher
MATCH (f:File)-[:CONTAINS]->(c:Component) WHERE f.projectId = $projectId AND c.projectId = $projectId AND (c.name CONTAINS 'login' OR c.name CONTAINS 'Login' OR f.path CONTAINS 'login' OR f.path CONTAINS 'Login') RETURN f.path as file, c.name as component
\`\`\`

Pregunta: "rutas que tengan auth"
\`\`\`cypher
MATCH (r:Route) WHERE r.projectId = $projectId AND (r.path CONTAINS 'auth' OR r.componentName CONTAINS 'auth') RETURN r.path, r.componentName
\`\`\`

Pregunta: "llamadas a endpoints" / "funciones que hacen fetch o request" / "cómo se llaman al back"
\`\`\`cypher
MATCH (fn:Function) WHERE fn.projectId = $projectId AND (fn.name CONTAINS 'fetch' OR fn.name CONTAINS 'get' OR fn.name CONTAINS 'post' OR fn.name CONTAINS 'put' OR fn.name CONTAINS 'request' OR fn.name CONTAINS 'call' OR fn.name CONTAINS 'api' OR fn.path CONTAINS 'api') RETURN fn.path as path, fn.name as name, fn.description as description ORDER BY fn.path, fn.name
\`\`\`

Pregunta: "utilidades comunes" o "funciones para extraer a biblioteca compartida"
\`\`\`cypher
MATCH (caller:Function)-[:CALLS]->(fn:Function) WHERE fn.projectId = $projectId AND caller.projectId = $projectId
WITH fn.path as path, fn.name as name, collect(DISTINCT caller.path) as llamadores
WHERE size(llamadores) > 1
RETURN path, name, size(llamadores) as usos ORDER BY usos DESC
\`\`\`

Pregunta: "funciones no utilizadas" / "dead code" / "auditoría para eliminar código muerto"
\`\`\`cypher
MATCH (fn:Function) WHERE fn.projectId = $projectId
OPTIONAL MATCH (caller)-[:CALLS]->(fn)
WITH fn, count(caller) as callCount
WHERE callCount = 0
RETURN fn.path as path, fn.name as name ORDER BY fn.path
\`\`\`

Pregunta: "componentes que no se renderizan desde ningún otro"
\`\`\`cypher
MATCH (c:Component) WHERE c.projectId = $projectId
OPTIONAL MATCH (parent)-[:RENDERS]->(c)
WITH c, count(parent) as parentCount
WHERE parentCount = 0
RETURN c.name as name
\`\`\`

Pregunta: "reporte detallado de componentes y funciones que no se utilizan" / "listado de código muerto" / "todos los no usados"
→ Ejecutar AMBAS consultas (1) funciones no llamadas: OPTIONAL MATCH (caller)-[:CALLS]->(fn) WHERE count=0; (2) componentes no renderizados: OPTIONAL MATCH (parent)-[:RENDERS]->(c) WHERE count=0. NO usar CONTAINS con nombres concretos. Devolver TODOS los resultados (sin LIMIT).

Pregunta: "funciones con alto acoplamiento" o "complejidad en funciones"
\`\`\`cypher
MATCH (a:Function)-[:CALLS]->(b:Function) WHERE a.projectId = $projectId AND b.projectId = $projectId
WITH a, count(b) as outCalls WHERE outCalls > 5
RETURN a.path as path, a.name as name, outCalls ORDER BY outCalls DESC
\`\`\`

Pregunta: "componentes con muchas props" o "componentes complejos"
\`\`\`cypher
MATCH (c:Component)-[:HAS_PROP]->(p:Prop) WHERE c.projectId = $projectId
WITH c, count(p) as propCount WHERE propCount > 5
RETURN c.name as component, propCount ORDER BY propCount DESC
\`\`\`

Pregunta: "código spaguetti" o "funciones con mucho anidamiento"
\`\`\`cypher
MATCH (fn:Function) WHERE fn.projectId = $projectId AND fn.nestingDepth > 4
RETURN fn.path as path, fn.name as name, fn.nestingDepth as nestingDepth, fn.complexity as complexity ORDER BY fn.nestingDepth DESC
\`\`\`

Pregunta: "cómo es el proceso de consulta a falkor", "cómo se conecta al grafo", "flujo de FalkorDB"
\`\`\`cypher
MATCH (fn:Function) WHERE fn.projectId = $projectId AND (fn.name CONTAINS 'falkor' OR fn.name CONTAINS 'Falkor' OR fn.path CONTAINS 'falkor' OR fn.path CONTAINS 'Falkor' OR fn.description CONTAINS 'falkor')
RETURN fn.path as path, fn.name as name, fn.description as description ORDER BY fn.path, fn.name
\`\`\`
(Tras obtener paths: get_file_content OBLIGATORIO para explicar el flujo.)

Pregunta: "cálculos del cotizador", "algoritmo de precios", "resumir lógica de X"
\`\`\`cypher
MATCH (fn:Function) WHERE fn.projectId = $projectId
AND (fn.name CONTAINS 'cotizador' OR fn.description CONTAINS 'cotizador' OR fn.path CONTAINS 'cotizador' OR fn.path CONTAINS 'Cotizador'
  OR fn.name CONTAINS 'precio' OR fn.name CONTAINS 'Precio' OR fn.name CONTAINS 'bonus' OR fn.name CONTAINS 'Bonus'
  OR fn.name CONTAINS 'actualizar' OR fn.name CONTAINS 'Actualizar' OR fn.name CONTAINS 'calcular' OR fn.name CONTAINS 'Calcular')
RETURN fn.path as path, fn.name as name, fn.description as description ORDER BY fn.path, fn.name
\`\`\`

Pregunta: "qué tipos de cotizaciones", "qué opciones en el cotizador" — PREFIERE DomainConcept:
\`\`\`cypher
MATCH (dc:DomainConcept) WHERE dc.projectId = $projectId
RETURN dc.name as name, dc.category as category, dc.options as options, dc.sourcePath as sourcePath
ORDER BY dc.category, dc.name
\`\`\`
(Alternativa si DomainConcept devuelve poco: buscar Functions con cotizador/cotizacion/renta/bonus, NO solo 'tipo'. Tras obtener paths: get_file_content OBLIGATORIO.)

Pregunta: "¿archivo A importa a B?", "¿A importa B pero lo usa?"
\`\`\`cypher
MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.projectId = $projectId AND b.projectId = $projectId
AND a.path = $pathA AND b.path = $pathB
RETURN a.path as fromPath, b.path as toPath
\`\`\`
(Usa IMPORTS entre File, NO CONTAINS/Component. Para "lo usa" consulta CALLS entre Function si aplica.)

Pregunta: "tablas de base de datos", "esquema BD", "modelos de datos", "entidades", "schema"
→ OPCION A (Prisma): execute_cypher nodos Model/Enum (m.source = 'prisma') y get_file_content del schema si hace falta el texto.
→ OPCION B (TypeORM): nodos :Model con m.source = 'typeorm' (ingest detecta clases decoradas con @Entity). **No uses** (File)-[:CONTAINS]->(Component) con "Entity" en el nombre: Component es UI/React, no ORM. Listado típico sin migraciones:
\`\`\`cypher
MATCH (m:Model)
WHERE m.projectId = $projectId AND m.source = 'typeorm'
AND NOT (m.path CONTAINS '/migrations/')
RETURN m.path as path, m.name as name
ORDER BY m.path
\`\`\`
(Repo concreto en monorepo: añade AND m.repoId = $repoId. Si faltan filas tras resync, incluye modelos antiguos con OR m.path CONTAINS ".entity".)
→ OPCION C (monorepo): probar apps/api/prisma/schema.prisma, libs/db/prisma/schema.prisma, libs/*/entity*.ts, **/entities/*.ts

Pregunta: "rutas de API", "endpoints", "listado de rutas REST"
→ Strapi backend: OpenApiOperation (swagger/full_documentation) o StrapiRoute (routes custom/core):
\`\`\`cypher
MATCH (op:OpenApiOperation) WHERE op.projectId = $projectId RETURN op.method AS method, op.pathTemplate AS pathTemplate, op.specPath AS specPath ORDER BY op.pathTemplate, op.method
\`\`\`
\`\`\`cypher
MATCH (sr:StrapiRoute) WHERE sr.projectId = $projectId RETURN sr.method AS method, sr.routePath AS routePath, sr.apiName AS apiName, sr.routeSource AS routeSource ORDER BY sr.routePath
\`\`\`
→ NestJS: NestController. → React front: Route.

Pregunta: "content-types Strapi", "modelo de datos campania", "schema User permissions"
\`\`\`cypher
MATCH (ct:StrapiContentType) WHERE ct.projectId = $projectId AND (ct.name CONTAINS 'campania' OR ct.strapiUid CONTAINS 'campania' OR ct.attributesSummary CONTAINS 'campania') RETURN ct.path AS path, ct.name AS name, ct.strapiUid AS strapiUid, ct.attributesSummary AS attributesSummary
\`\`\`

Pregunta: "relaciones entre entidades Strapi", "qué modelos enlaza campania"
\`\`\`cypher
MATCH (src:StrapiContentType)-[r:RELATES_TO]->(tgt:StrapiContentType) WHERE src.projectId = $projectId AND tgt.projectId = $projectId RETURN src.strapiUid AS from, r.attribute AS attribute, r.relation AS relation, tgt.strapiUid AS to
\`\`\`

Pregunta: "qué front llama a qué API", "referencias api/campanias en el código"
\`\`\`cypher
MATCH (f:File)-[:REFERENCES_API]->(ref:ApiClientReference)-[:CALLS_API]->(op:OpenApiOperation) WHERE f.projectId = $projectId RETURN f.path AS file, ref.apiPath AS apiPath, op.method AS method, op.pathTemplate AS pathTemplate LIMIT 50
\`\`\`

Pregunta: "endpoints del backend no usados en el front", "rutas Strapi sin uso en oohbp2", "qué rutas del back no consume el frontend"
\`\`\`cypher
MATCH (sr:StrapiRoute) WHERE sr.projectId = $projectId
OPTIONAL MATCH (refLink:ApiClientReference)-[:CALLS_STRAPI_ROUTE]->(sr)
OPTIONAL MATCH (ref:ApiClientReference) WHERE ref.projectId = $projectId AND ref.repoId <> sr.repoId AND (sr.routePath = '/' + ref.normalizedPath OR (sr.routePath STARTS WITH '/' AND ref.normalizedPath ENDS WITH substring(sr.routePath, 1)))
WITH sr, count(refLink) AS relCount, count(ref) AS heuristicCount
WHERE relCount = 0 AND heuristicCount = 0
RETURN sr.method AS method, sr.routePath AS routePath, sr.apiName AS apiName, sr.routeSource AS routeSource
ORDER BY sr.routePath, sr.method
\`\`\`
(No uses solo MATCH (f:File) CONTAINS 'api/' ni un IN manual de rutas; cruza :StrapiRoute con :ApiClientReference.)

Pregunta: "lifecycles de campania", "hooks beforeUpdate"
\`\`\`cypher
MATCH (f:File)-[:LIFECYCLE_OF]->(ct:StrapiContentType) WHERE f.projectId = $projectId AND ct.projectId = $projectId RETURN f.path AS lifecycleFile, ct.strapiUid AS contentType
\`\`\`

Pregunta: "config Strapi", "middlewares", "plugins activos"
\`\`\`cypher
MATCH (f:File) WHERE f.projectId = $projectId AND f.fileRole = 'strapi_config' RETURN f.path AS path ORDER BY f.path
\`\`\`

(O también Route para frontend. NestController tiene .route en propiedades; get_file_content en path para ver decoradores @Get, @Post.)

Pregunta: "variables de entorno", "configuración env", "qué env vars usa"
→ get_file_content en: .env.example, env.example, .env.sample, apps/*/.env.example. No están en el grafo.

IMPORTANTE: NO uses LIMIT. Devolver todos los resultados evita perder conocimiento. FalkorDB no soporta NOT EXISTS; usa OPTIONAL MATCH + count(x)=0 para "no usados".

<fin_ejemplos>
--- Edge cases ---
Pregunta: "no encuentro nada sobre xyz inexistente" / "busco componente Quijote" (no existe en grafo)
\`\`\`cypher
MATCH (c:Component) WHERE c.projectId = $projectId AND (c.name CONTAINS 'Quijote' OR c.name CONTAINS 'xyz') RETURN c.name LIMIT 5
\`\`\`
(Si devuelve []; responde: "No encontré resultados. Verifica el término o reindexa.")

Pregunta mal formada / ambigua ("dame todo" sin contexto)
→ Primero get_graph_summary o execute_cypher con criterio amplio; si no hay contexto de dominio, pide al usuario especificar.
</fin_ejemplos>
`;

/** Nombres de funciones genéricas (event handlers, lifecycle) que se omiten del análisis de duplicados. */
export const GENERIC_FUNCTION_NAMES = new Set([
  'onsubmit', 'onreset', 'onchange', 'onclick', 'onblur', 'onfocus', 'onkeydown', 'onkeyup', 'onkeypress',
  'oninput', 'onmousedown', 'onmouseup', 'onmouseover', 'onmouseout', 'onscroll', 'onload', 'onerror',
  'handlesubmit', 'handlechange', 'handleclick', 'handleblur', 'handlefocus', 'handlekeydown', 'handleinput',
  'componentdidmount', 'componentdidupdate', 'componentwillunmount', 'getderivedstatefromprops', 'shouldcomponentupdate',
  'render', 'constructor', 'getdefaultprops', 'defaultprops', 'onItemClick', 'onItemChange', 'onItemSelect', 'onItemDeselect',
  'onItemHover', 'onItemLeave', 'onItemEnter', 'onItemFocus', 'onItemBlur', 'onItemScroll', 'onItemScrollEnd', 'onItemScrollStart',
  'onItemScrollEnd', 'onItemScrollStart', 'onItemScrollEnd', 'onItemScrollStart', 'onItemScrollEnd', 'onItemScrollStart',
]);

export const MAX_RISK_ITEMS = 120;
export const MAX_HIGH_COUPLING = 40;
export const MAX_NO_DESC = 100;
export const MAX_COMPONENT_PROPS = 30;
export const MAX_DUPLICATES = 50;
export const MAX_ANTIPATTERN_ITEMS = 40;
export const MAX_SUMMARY_CHARS = 4000;

/** Límite por defecto de aristas CALL para métricas extrínsecas con scope. Override: `MAX_ANALYZE_CALL_EDGES`. */
export const MAX_ANALYZE_CALL_EDGES = 80_000;

export function getMaxAnalyzeCallEdges(): number {
  const raw = process.env.MAX_ANALYZE_CALL_EDGES?.trim();
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1000 ? Math.min(n, 500_000) : MAX_ANALYZE_CALL_EDGES;
}

export const SEARCH_SYNONYMS: Record<string, string[]> = {
  login: ['auth', 'signin', 'sign-in', 'signin', 'autenticacion', 'authentication'],
  auth: ['login', 'signin', 'autenticacion'],
  signin: ['login', 'auth', 'sign-in'],
  ingesta: ['ingest', 'sync', 'indexacion'],
  ingest: ['ingesta', 'sync'],
  sync: ['ingest', 'ingesta'],
};

export const FULL_AUDIT_SECRET_PATTERNS: Array<{ pattern: RegExp; severity: string }> = [
  { pattern: /(?:api[_-]?key|apikey|api_key)\s*=\s*['"`][^'"`]+['"`]/gi, severity: 'critica' },
  { pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"`][^'"`]+['"`]/gi, severity: 'critica' },
  { pattern: /(?:secret|token)\s*[=:]\s*['"`][^'"`]{8,}['"`]/gi, severity: 'alta' },
  { pattern: /Bearer\s+[A-Za-z0-9_-]{20,}/g, severity: 'alta' },
  { pattern: /(?:private[_-]?key|privatekey).*['"`]/gi, severity: 'critica' },
  { pattern: /\.env\.\w+\s*[=:]/gi, severity: 'media' },
];

/** Tools para Explorer ReAct — CodeAnalysis: todas; Knowledge: sin get_graph_summary (Task-Level Scoping). */
export const EXPLORER_TOOLS_ALL = [
  {
    type: 'function',
    function: {
      name: 'execute_cypher',
      description: 'Ejecuta una consulta Cypher en el grafo del proyecto. Usa para buscar archivos, componentes, funciones, rutas, dependencias.',
      parameters: {
        type: 'object',
        properties: {
          cypher: {
            type: 'string',
            description: 'Consulta Cypher. DEBE incluir projectId = $projectId en el WHERE. NO usar LIMIT.',
          },
        },
        required: ['cypher'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'semantic_search',
      description: 'Búsqueda semántica por significado (ideal para "utilidades de X", "código que hace Y"). Requiere embed-index.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Pregunta o términos de búsqueda semántica' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_graph_summary',
      description:
        'Obtiene conteos y listados completos de nodos indexados (File, Component, Function, Route, Model, …), sin LIMIT por defecto. Para muestra acotada usar la API con full=0.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_file_content',
      description: 'Lee el contenido de un archivo del repo. OBLIGATORIO para: tipos/opciones, algoritmo, cálculos. Esquema BD: Prisma → prisma/schema.prisma; TypeORM → execute_cypher MATCH (m:Model) para path. Rutas API: NestController/Route. Env: .env.example.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path del archivo (relativo al repo). Para Prisma: prisma/schema.prisma. Para TypeORM: path de nodo Model.' },
        },
        required: ['path'],
      },
    },
  },
];

/** Subset para Knowledge: get_file_content obligatorio, sin get_graph_summary. */
export function getExplorerToolsKnowledge(): typeof EXPLORER_TOOLS_ALL {
  return EXPLORER_TOOLS_ALL.filter(
    (t) => (t as { function?: { name?: string } }).function?.name !== 'get_graph_summary',
  );
}

/** Intención de volcado íntegro (sin síntesis), reutilizable en detectores por dominio. */
function wantsFullDumpIntent(message: string, lower: string): boolean {
  return (
    /lista\s+(completa|total|entera)|listado\s+completo|listados?\s+completos?/i.test(lower) ||
    /inventario\s+completo/i.test(lower) ||
    /no\s+(quiero|sólo|solo)\s+(algunos|unos?\s+pocos|ejemplos?)/i.test(message) ||
    /enumer(ar|a)\s+todos/i.test(lower) ||
    /sin\s+resumir|sin\s+sintetizar|sin\s+omitir|exhaustiv|íntegro|integro|exactos?|completos?\s+exactos?/i.test(message) ||
    /(all|every|full|complete)\s+(the\s+)?(list|inventory)\s+of/i.test(lower)
  );
}

/**
 * Listado completo de nodos `Component` sin pasar por el sintetizador (tabla markdown desde Cypher).
 */
export function wantsFullComponentListing(message: string): boolean {
  const t = message.trim();
  const lower = t.toLowerCase();
  const hasComponentKeyword =
    /\bcomponente?s?\b/i.test(t) ||
    /\bcomponents?\b/i.test(lower) ||
    /\b(ui|react)\s+components?\b/i.test(lower);
  if (!hasComponentKeyword) return false;

  if (
    /\b(endpoints?|api\s*routes?|rutas?\s+api)\b/i.test(t) &&
    !/\bcomponente?s?\b/i.test(t) &&
    !/\bcomponents?\b/i.test(lower)
  ) {
    return false;
  }

  return (
    /todos?\s+los\s+componente/i.test(t) ||
    /todas?\s+las\s+componente/i.test(t) ||
    wantsFullDumpIntent(t, lower) ||
    /(all|every|full|complete)\s+(the\s+)?(list|inventory)\s+of\s+components?\b/i.test(lower) ||
    /enumer(ar|a)\s+todos\s+los\s+componente/i.test(lower) ||
    (/sin\s+resumir|sin\s+sintetizar|sin\s+omitir|exactos?|íntegro|integro|completos?\s+exactos?/i.test(t) &&
      /\bcomponente/i.test(t))
  );
}

/**
 * Inventario íntegro del índice (varias etiquetas del grafo), sin vocabulario fijo «componente».
 */
export function wantsFullGenericIndexedInventory(message: string): boolean {
  if (wantsFullComponentListing(message)) return false;

  const t = message.trim();
  const lower = t.toLowerCase();

  const indexedEntityLanguage =
    /\b(elementos?|entidades)\b/i.test(t) ||
    /\belementos?\s+involucrados?\b/i.test(t) ||
    /\bnodos?\s+((del|en)\s+)?(el\s+)?(grafo|índice|indice)\b/i.test(lower) ||
    /\b(artefactos?|piezas?)\s+(indexados?|involucradas?|del\s+índice|del\s+indice)\b/i.test(lower) ||
    /\b(inventario|índice|indice)\s+((del|de)\s+)?(grafo|proyecto|repo|monorepo)\b/i.test(lower) ||
    /\b(inventario|índice|indice)\s+(completo|íntegro|integro|total)\b/i.test(lower) ||
    /\btodo\s+lo\s+indexado\b/i.test(lower) ||
    /\b(grafo|índice|indice)\s+(completo|íntegro|integro)\b/i.test(lower) ||
    /\b(símbolos?|unidades?)\s+indexados?\b/i.test(lower) ||
    (/\brecursos?\b/i.test(t) &&
      /\b((del|de)\s+)?(repo|repositorio|proyecto|monorepo|código|codigo)\b/i.test(lower) &&
      /\b(lista|listado|todos|todas|completo|inventario|enumer|sin\s+resumir)\b/i.test(lower)) ||
    /\b(entities|indexed\s+items?|graph\s+nodes?|everything\s+in\s+the\s+index)\b/i.test(lower);

  if (!indexedEntityLanguage) return false;

  const fullIntent =
    wantsFullDumpIntent(t, lower) ||
    /todos?\s+los\s+(elementos|entidades|nodos)\b/i.test(t) ||
    /todas?\s+las\s+(entidades|elementos|piezas)\b/i.test(t) ||
    /\ball\s+(the\s+)?(elements|entities|nodes)\b/i.test(lower);

  return fullIntent;
}

/** Trunca antipatterns para caber en contexto. */
export function truncateAntipatterns(ap: {
  spaghetti?: unknown[];
  godFunctions?: unknown[];
  highFanIn?: unknown[];
  circularImports?: unknown[];
  overloadedComponents?: unknown[];
}) {
  return {
    spaghetti: (ap?.spaghetti ?? []).slice(0, MAX_ANTIPATTERN_ITEMS),
    godFunctions: (ap?.godFunctions ?? []).slice(0, MAX_ANTIPATTERN_ITEMS),
    highFanIn: (ap?.highFanIn ?? []).slice(0, MAX_ANTIPATTERN_ITEMS),
    circularImports: (ap?.circularImports ?? []).slice(0, MAX_ANTIPATTERN_ITEMS),
    overloadedComponents: (ap?.overloadedComponents ?? []).slice(0, MAX_ANTIPATTERN_ITEMS),
  };
}
