# ariadne-mcp (AriadneSpecs MCP Server)

Servidor MCP que expone herramientas de contexto sobre el grafo en FalkorDB.

**Transporte:** Streamable HTTP (puerto 8080 o `PORT`). **Modo stateless:** un Server+Transport por request, evita el error "Server already initialized" cuando Cursor reintenta el handshake. Con autenticación activa (`MCP_HTTP_ALLOW_UNAUTHENTICATED` sin definir), cada petición a `/mcp` lleva **`Authorization: Bearer`** con el **Secret MCP** (`ari_…` de Perfil) o un **JWT de sesión** válido — el proceso valida vía ingest y reenvía el mismo Bearer al API Nest cuando hace falta.

**Logs de invocación (Dokploy / The Forge):** por defecto cada `tools/call` escribe en stdout JSON en una línea: `mcp_tool_call_start` (nombre, claves de argumentos, payload redactado/truncado), `mcp_tool_call_end` (ms, `resultSummary`, **`result`** con `content[]` devuelto al cliente — texto por bloque hasta `MCP_TOOL_LOG_RESPONSE_BLOCK_MAX`, cupo total `MCP_TOOL_LOG_RESPONSE_TOTAL_MAX`, flag `responseTruncated`), o `mcp_tool_call_error`. También `mcp_list_tools` al listar herramientas. Desactivar: `MCP_TOOL_LOG=0`. Límite de tamaño de la **línea** de log: `MCP_TOOL_LOG_ARG_MAX` (default 12000; súbelo si trunca el JSON entero antes de ver la respuesta).

**`ask_codebase` largo:** `mcp_tool_call_end` solo aparece cuando termina el POST a ingest/orchestrator (puede ser minutos). Mientras tanto, con `MCP_TOOL_LOG` activo, cada **`MCP_ASK_CODEBASE_PROGRESS_LOG_MS`** (default **60000**; `0`/`off` desactiva) se escribe **`mcp_tool_call_progress`** con `elapsedIngestFetchMs`, `elapsedSinceToolStartMs`, `responseMode`, `ingestAbortAfterMs` y prefijo de `projectId`.

## JSDoc del catálogo de herramientas

- Fuente TypeDoc/JSDoc: **`src/mcp-tools.doc.ts`** — tabla resumida de cada `name` MCP, revision `MCP_ARIADNE_TOOLS_DOC_REVISION` (incrementar al cambiar el set de tools en `index.ts`).
- El manifiesto runtime (`description` + `inputSchema`) sigue definido en **`src/index.ts`** dentro de `ListToolsRequestSchema`.

## Publicar a npm

```bash
cd services/mcp-ariadne
npm login
npm publish
```

## Herramientas

### Core
- **list_known_projects** — Proyectos indexados (`id` = proyecto Ariadne, `roots[]` = repos). El texto de respuesta indica que para **`get_modification_plan`** en multi-root conviene usar `roots[].id` del repo donde está el código (p. ej. frontend).
- **get_component_graph** — Por defecto intenta **`GET /api/graph/component/:name`** (mismo grafo que el explorador: RENDERS, USES_HOOK, IMPORTS, `graphHints`, fusión multi-shard). Requiere **`ARIADNE_API_URL`** y **`Authorization: Bearer`** en Cursor (Secret MCP `ari_…` o JWT web); el proceso lo reenvía al Nest **sin variables `ARIADNE_API_*`** en `.env`. Sin Bearer válido, **fallback** Falkor genérico `-[*1..depth]->`.
- **get_legacy_impact** — Preferencia: **`GET /api/graph/impact/:nodeId`** (`GraphService.getImpact`). Misma regla Bearer reenviable que `get_component_graph`. Fallback: Falkor `CALLS|RENDERS*` en un shard.
- **get_contract_specs** — Props (con `description` JSDoc si existe); sigue siendo solo Falkor.
- **get_functions_in_file**, **get_import_graph** — Contenido estructural de archivos.
- **get_file_content** — Contenido crudo del archivo desde Bitbucket/GitHub (requiere INGEST_URL).
- **validate_before_edit** — OBLIGATORIO antes de editar: impacto + contrato en un llamado.
- **semantic_search** — Búsqueda por palabra clave en componentes, funciones y archivos.
- **generate_legacy_documentation** — **Modo único** para documentación legacy (TheForge SDD): MDD de partida con retrieve determinista + `buildMddEvidenceDocument` (JSON 7 claves, sin prosa LLM). Parámetros: `projectId`, opcional `scope`, `currentFilePath`. Timeout: **`MCP_LEGACY_DOCUMENTATION_TIMEOUT_MS`** (default 900s). **No usar `ask_codebase` con distintos `responseMode` para doc. de partida.**
- **ask_codebase** — Preguntas en NL (Q&A humano). Parámetro **`responseMode`:** `default`, **`evidence_first`**, **`raw_evidence`**. **Doc. legacy:** usar **`generate_legacy_documentation`**. Si omites `responseMode`, el MCP envía **`default`** (prosa + ReAct).
- **get_project_analysis** — Deuda técnica, duplicados, reingeniería, código muerto o **seguridad** (heurística; requiere INGEST_URL). `projectId` puede ser id de **proyecto** o **`roots[].id`** (repo); si es proyecto multi-root, usa **`currentFilePath`** o pasa el id del repo. Opcional: **`scope`** (mismo shape que `ask_codebase`), **`crossPackageDuplicates`** (modo duplicados). El MCP llama a `POST /projects/.../analyze` o `POST /repositories/.../analyze`. Si la respuesta trae **`reportMeta`**, se añade un bloque JSON al final del markdown.
- **get_modification_plan** — Plan vía `POST /projects/:id/modification-plan` (`userDescription`, opcional **`scope`**, **`currentFilePath`**, **`questionsMode`**: `business` | `technical` | `both`). Respuesta puede incluir **`warnings`** y **`diagnostic`**. `projectId` = proyecto o `roots[].id`.

### Refactorización segura (árbol de llamadas)
- **get_definitions** — Origen exacto de clase/función (archivo, líneas). Evita alucinaciones al refactorizar.
- **get_references** — Todos los lugares donde se usa un símbolo.
- **get_implementation_details** — Firma, tipos, props, endpoints. Asegura que el nuevo código respete la estructura existente.

### Código muerto
- **trace_reachability** — Funciones/componentes nunca llamados desde puntos de entrada (rutas, index, main).
- **check_export_usage** — Exports sin importaciones activas en el monorepo.

### Análisis de impacto
- **get_affected_scopes** — Qué nodos y archivos (incl. tests) se verían afectados por una modificación.
- **check_breaking_changes** — Compara firma antes/después; alerta si se eliminan params usados en N sitios.

### Código sin duplicación
- **find_similar_implementations** — Búsqueda semántica antes de escribir código nuevo.
- **get_project_standards** — Prettier, ESLint, tsconfig para que el código nuevo siga los estándares.

### Workflow
- **get_file_context** — Combina contenido + imports + exports. Paso 2: search → get_file_context → validate/apply.

### Mapa de navegación (legacy flow)
- **generate_navigation_map** — Escanea el proyecto frontend (React Router, Next.js) y genera un mapa completo: rutas con parámetros, componentes que renderiza, formularios (estáticos y dinámicos), endpoints consumidos, componentes compartidos entre ≥2 rutas, path aliases (tsconfig) y apiClient detectado. Soporta diff mode (`scope=diff` + `baselineSnapshot`) para comparar contra un snapshot previo. Requiere `projectId` (de `list_known_projects`).

**Enrutamiento y whitelist de dominios:** Con `INGEST_URL`, el MCP llama a **`GET /projects/:id/graph-routing`** y usa **`cypherShardContexts`**: lista de `{ graphName, cypherProjectId }`. Cada consulta Cypher debe filtrar con el `projectId` que realmente tienen los nodos en ese grafo (propio proyecto + proyectos en dominios permitidos en **ProjectDomainDependency**). Sin esto, los grafos “hermanos” devolverían 0 filas. `forEachProjectShardGraph` y búsquedas que fusionan filas pasan el `cypherProjectId` correcto por shard.

**`semantic_search`, `find_similar_implementations` y id de proyecto vs repo:** `list_known_projects` devuelve `roots[].id` (**repositorio**). En Falkor, los nodos llevan `projectId` = UUID del **proyecto** Ariadne cuando el repo está enlazado; `roots[].id` coincide con `repoId`. **`resolve-graph-scope.ts`** llama `GET /repositories/:id` en ingest, mapea al `cypherProjectId` correcto y, si aplica, añade `AND n.repoId = $repoId` para no mezclar repos en multi-root. Ambas herramientas enrutan con `runOnProjectGraphs`/`forEachProjectShardGraph` y el mismo filtro. Sin este paso, filtrar por `roots[].id` como si fuera `projectId` devolvía **0 filas** (MDD vacío pese a índice sano).

**OpenAPI en `semantic_search`:** el vector suele cubrir `Function` / `Component` / `Document` / `MarkdownDoc`…; los nodos **`:OpenApiOperation`** (spec indexado) no llevan embedding. Tras vector/keyword, si hay cupo en `limit` se **mezclan** operaciones vía `MATCH (op:OpenApiOperation)` filtrando por proyecto/repo (mismos parámetros que el resto). Útil para consultas tipo API/routes/swagger aunque el vector devolviera hits de markdown.

Variables: `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKOR_SHARD_BY_PROJECT`, `FALKOR_SHARD_BY_DOMAIN`, `INGEST_URL` (obligatorio para routing completo y herramientas que listan proyectos).

### Límites de salida (defaults altos — información completa)

Las herramientas ya no recortan agresivamente listados y snippets; puedes **bajar** estos valores si saturan el contexto del LLM o el tiempo de Falkor. Ver `src/mcp-tool-limits.ts`.

| Prefijo env | Ejemplos |
|-------------|----------|
| `MCP_SEMANTIC_SEARCH_*` | `DEFAULT`, `MAX`, `VECTOR_K_MAX`, `KEYWORD_SUBQUERY_LIMIT` |
| `MCP_FILE_CONTEXT_MAX_CHARS` | Contenido en **get_file_context** |
| `MCP_STANDARDS_FILE_SNIPPET_CHARS` | Snippets en **get_project_standards** |
| `MCP_AFFECTED_NODES_MAX`, `MCP_AFFECTED_FILES_MAX` | **get_affected_scopes** |
| `MCP_UNUSED_EXPORTS_MAX` | **check_export_usage** |
| `MCP_IMPLEMENTATION_*` | Descripciones y `FUNCTIONS_LIMIT` (**get_implementation_details**, **validate_before_edit**) |
| `MCP_DEFINITIONS_PER_KIND_LIMIT` | **get_definitions** |
| `MCP_TRACE_*` | **trace_reachability** (listas + query funciones no llamadas) |
| `MCP_FIND_SIMILAR_*` | **find_similar_implementations** |
| `MCP_DEBT_REPORT_ISOLATED_LIMIT` | **get_debt_report** |
| `MCP_FIND_DUPLICATES_GROUP_LIMIT` | **find_duplicates** |
| `MCP_SYNC_STATUS_RECENT_JOBS_MAX` | Jobs recientes en **get_sync_status** |

### Resolución multi-root (sin depender solo del cwd)

- **`mcp-scope-enrichment.ts`** — Orden: `.ariadne-project` subiendo directorios desde `currentFilePath` → si hace falta, ingest `GET /projects/:id/resolve-repo-for-path?path=` para acotar el repo → fallback al grafo Falkor como antes.
- **`ask_codebase`** y **`get_modification_plan`** mezclan en `scope.repoIds` el repo inferido cuando el IDE envía ruta de fichero.

## Uso (producción / Docker)

- Transporte: **Streamable HTTP** en `0.0.0.0:8080` (o `PORT`).
- Requiere FalkorDB con el grafo `AriadneSpecs` ya poblado.
- **Conexión Falkor:** el cliente registra `error` (no tumba el proceso ante `Socket closed unexpectedly`), usa `pingInterval` y `reconnectStrategy` vía Redis. Reinicios de Falkor o cortes de red pueden loguearse sin exit de Node; si el servicio MCP sigue unhealthy, revisa red/DNS hasta Falkor.
- **Auth (`/mcp`, producción):** el cliente envía **`Authorization: Bearer`** (Secret MCP `ari_…` de Perfil o JWT de sesión); el proceso valida vía ingest y reenvía el mismo Bearer al Nest en herramientas de grafo.

Variables: `PORT` (8080), `FALKORDB_HOST`, `FALKORDB_PORT`, `INGEST_URL`, **`ARIADNE_API_URL`** (solo URL base Nest; sin tokens de usuario en `.env`).

### Cursor (HTTP): `~/.cursor/mcp.json`

Servidor **Streamable HTTP** en `http://127.0.0.1:9888/mcp` cuando usas **docker-compose.dev.yml** (mapeo **9888→8080** en el contenedor; evita choque con Apache u otros en `:8080`). Si ejecutas el MCP con `PORT=8080` en el host, usa `http://127.0.0.1:8080/mcp`.

```json
{
 "mcpServers": {
 "ariadne-local": {
 "url": "http://127.0.0.1:9888/mcp",
 "headers": {
 "Authorization": "Bearer <Secret MCP del Perfil (ari_…) o JWT de sesión>"
 }
 }
 }
}
```

Con **Docker Compose dev** (`docker-compose.yml` + `docker-compose.dev.yml`): el servicio `mcp-ariadne` publica **`127.0.0.1:9888`** y a menudo tiene **`MCP_HTTP_ALLOW_UNAUTHENTICATED=true`** (omitir Bearer solo en pruebas locales). En producción deja **`MCP_HTTP_ALLOW_UNAUTHENTICATED` sin definir** y configura el Bearer en `mcp.json`.

Para **paridad** con el explorador en grafos Nest, necesitas **`ARIADNE_API_URL`** correcta **y** Bearer vigente (única fuente: Cursor `headers`, mismo token que usa el usuario en web o el Secret MCP persistente).

### Variables MCP ↔ Cursor / Docker

Compose puede inyectar solo **`ARIADNE_API_URL`** (p. ej. `http://api:3000`). Los tokens de sesión / Secret MCP **no** van en variables de entorno del contenedor MCP: van en la config de Cursor como arriba. Sin Bearer en la petición (y sin modo allow-unauth) la API responde **401** y las tools con fallback usan Falkor.

### Caché de herramientas MCP (no es la caché de `analyze`)

Las herramientas **get_component_graph**, **get_legacy_impact** y **get_sync_status** pueden cachear respuestas cortas (clave `v2` para grafo/impacto tras alinear con el API):

- **Por defecto** (sin `MCP_REDIS_URL` ni `REDIS_URL`, o con `MCP_REDIS_DISABLED=1`): caché **en memoria** del proceso (TTL 30–120 s según herramienta).
- **Redis:** define `MCP_REDIS_URL` o `REDIS_URL` para compartir caché entre instancias. La caché de informes **`get_project_analysis`** vive en **ingest** (ver `docs/notebooklm/plan-analyze-layer-cache.md`); el MCP no la duplica.

## Scripts

- `npm run build` — compila TypeScript.
- `npm start` — inicia el servidor HTTP Streamable (`PORT` / `MCP_HTTP_PORT`, default 8080).
