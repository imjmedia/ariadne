# Changelog

Todas las notas de versión de **Ariadne / FalkorSpecs** (monorepo). 
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [Unreleased]

## [1.3.0] — 2026-07-09

### Added

- **validate_change_plan (Gate 2):** tool MCP + `POST /projects/:id/validate-change-plan` en ingest. Audita `ChangePlan` JSON contra FalkorDB (archivos, símbolos, overlap modification-plan, cobertura tasks). Veredicto `APPROVED` | `APPROVED_WITH_WARNINGS` | `BLOCKED`. Contrato: `docs/contracts/change-plan-validation-v1.md`.

- **Docs MCP Server (`services/mcp-docs`):** nuevo servidor MCP con el SDK oficial que sirve la documentación estructurada de `docs_mcp/` a agentes de IA (filosofía atómica). **Recursos:** `docs://manifest` (JSON índice/jerarquía) y `docs://<section>/<topic>` (Markdown limpio). **Herramientas:** `search_docs(query)` y `get_component_api(componentName)`. Transporte **stdio** + **HTTP streamable** (`--http`, `/health`, puerto 8081). Servicio Docker `mcp-docs` en `docker-compose.yml` + `build:back`. Entrada `.cursor/mcp.json` (`ariadne-docs`). Smoke: `services/mcp-docs/scripts/smoke.mjs`. Complementa `mcp-ariadne` (grafo FalkorDB).
- **Corpus `docs_mcp/` (9 páginas):** plantilla + **arquitectura** (`services-layout`, `mcp-ariadne-overview` vs `docs-mcp-server`, `ingest-y-sharding` con proyecto↔repo y `FALKOR_SHARD_BY_PROJECT`, `navigation-map`) y **guías** (`agent-workflow`, `consumir-docs-mcp`, `graph-tools-catalog` con routing de costo de tools, `refactor-seguro` SDD `validate_before_edit`→`analyze_local_changes`).

### Removed

- **Modelo C4 (retirado):** eliminados pipeline sync `:System`/`:Container`, `GET /graph/c4-model`, MCP `get_c4_model`, endpoints ingest `…/architecture/c4`, módulo PlantUML/Kroki, `C4Previewer` y docs de diseño asociados. Se mantiene **gobierno de dominios** (`/domains`, whitelist, `GET /projects/:id/graph-routing`).

### Fixed

- **Healthchecks Dokploy / Traefik:** Con contenedores `unhealthy`, Dokploy no publica rutas Traefik → `404 page not found` en `/` y `/api` mientras `/mcp` sigue (MCP healthy). **Solución:** quitar `HEALTHCHECK` en `api` y `frontend` (probes incorrectos: `/health` vs `/api/health`, `wget` ausente en nginx:alpine).
- **Healthchecks reactivados en frontend y mcp-ariadne:** Se habían desactivado con el comentario "Dokploy no lo soporta correctamente". El problema real era usar `127.0.0.1` o DNS service-name en los healthchecks, no `localhost`. `localhost` es el loopback real del contenedor tanto en Compose como en Swarm, y funciona correctamente con Dokploy.
 - `services/mcp-ariadne/Dockerfile`: Node.js nativo en `http://localhost:8080/health`

### Added

- **Ingest — graph artifact bootstrap (Camino D phase 3):** export/import Falkor subgraph as `.ariadne/graph-<repoId>.jsonl.zst` + `manifest.json` (SHA-256, counts). `POST /repositories/:id/export-graph-artifact`; sync bootstrap import when clone contains artifact and local graph empty; optional post-sync export via `GRAPH_ARTIFACT_EXPORT_ON_SYNC=1`. See `docs/notebooklm/PLAN_CBM_PARITY_CAMINO_D.md`.
- **Docs — CALLS resolution benchmark (Camino D phase 4):** `docs/notebooklm/BENCHMARK_CALLS_RESOLUTION.md` + `scripts/benchmark-calls-resolution.ts` decision gate for LSP investment.
- **API — Shadow Graph multi-dimensional compare:** `GET /graph/compare/:componentName` ahora compara el componente en **5 dimensiones** (antes solo props): props con detección de cambio de `required`, relaciones `RENDERS` y `USES_HOOK`, dependencias (`IMPORTS` entre archivos y `CALLS` cross-file), funciones exportadas con detección de cambio de `lineRange`, e **impacto en dependientes** (reverse `RENDERS` + análisis de breaking changes por dependiente). Nuevo campo `verdict` (`approved` | `breaking_changes`). 12 queries en paralelo (6 main + 6 shadow). 12 métodos helper privados en `GraphService` (`queryNamed`, `diffNamed`, `detectChangedProps`, `detectChangedFunctions`, `buildDependentsImpact`, etc.). OpenAPI spec y ruta Express legacy actualizadas. Nuevo módulo `review` en ingest con pipeline completo de revisión de cambios legacy. Incluye 5 lentes de detección via LLM, consulta al grafo FalkorDB para impacto legacy, scoring con penalizaciones, validación profunda, cross-cutting review, y render de reporte Markdown con confianza porcentual. MCP tool `review_diff` registrada. Usa la misma infraestructura LLM existente (LLM_API_KEY, LLM_MODEL_INGEST, etc.) — no introduce nuevas APIs. (`docs/review-engine/README.md`)
- **Review Engine — PR URL support:** `review_diff` acepta `prUrl` de GitHub (`https://github.com/owner/repo/pull/123`). Descarga el diff via GitHub API con autenticación opcional (`GITHUB_TOKEN`/`GH_TOKEN`). Fallback a `/pulls/:id/files` si el diff directo no está disponible.

### Changed

- **Orchestrator — Kimi/Moonshot 429 TPM:** reintentos con espera larga cuando el JSON de error indica TPM / `rate_limit_reached` (default `MOONSHOT_TPM_RETRY_COOLDOWN_MS=58000`), hasta **8** intentos; backoff corto para otros 429/503. Ver `services/orchestrator/src/llm/README.md`.
- **Chat / graph-summary / retriever:** `full=true` es el **default** en servicio y `GET .../graph-summary` (subconjunto solo con `full=0` o `full=false`). `formatResultsHuman` sin tope por defecto; `get_graph_summary` tool deja de truncar JSON de muestras. Cliente frontend: solo envía `full=0` cuando se pide muestra explícita. MCP: descripción de `find_similar_implementations.limit` alineada con env (`MCP_FIND_SIMILAR_*`).
- **Ingest — parser TypeORM:** `@Entity()` en la línea **anterior** a `export class` vive en el nodo `export_statement` en tree-sitter; ahora se considera junto con decoradores de la clase, y se indexan también `**abstract_class_declaration`**. Vitest `parser-typeorm-entity.spec.ts`. Tras desplegar, **resync** del repo para repoblar `m:Model` con `source = 'typeorm'`.
- **Ingest — indexado:** rutas bajo segmento de carpeta `**migrations/`** (p. ej. TypeORM) quedan **excluidas** por defecto para evitar ruido en contexto; `**INDEX_MIGRATIONS=1`** las vuelve a indexar (`sync-path-filter.ts`, Vitest).
- **Documentación:** referencias de ayuda (`CHAT_Y_ANALISIS`, `ingestion_flow`, `bitbucket_webhook`, `DEPLOYMENT_DOKPLOY`, `TESTING`, caché/diagnóstico, observabilidad, métricas chat, RELIC, etc.) consolidadas bajo `**docs/notebooklm/`**; `copy-docs.sh`, `DocViewer.tsx`, README raíz, manuales y servicios actualizados.
- **Documentación:** `docs/db_schema.md` movido a `**docs/notebooklm/db_schema.md`**; enlaces y `frontend/scripts/copy-docs.sh` actualizados. Ayuda MCP/INSTALACION/arquitectura copian desde `docs/notebooklm/` cuando el archivo ya no está en la raíz de `docs/`.
- `**docs/mcp_server_specs.md**` → `**docs/notebooklm/mcp_server_specs.md**`; enlaces en README, MONOREPO, `types.ts`, etc.; copia estática `public/mcp_server_specs.md` en `copy-docs.sh`; enlace absoluto `/mcp_server_specs.md` en INSTALACION_MCP_CURSOR.
- `**docs/indexing_engine.md**` → `**docs/notebooklm/indexing_engine.md**`; README, manuales, `copy-docs.sh` y `DocViewer.tsx` actualizados.

### Added

- **Ingest — alcance del índice por repositorio:** columna `repositories.index_include_rules` (JSONB); `PATCH /repositories/:id` con `indexIncludeRules`; UI en **Editar repositorio** (`/repos/:id/edit`). Con reglas activas: siempre `package.json` y `*.json|js|ts|jsx|tsx` en raíz; entradas `path_prefix` / `file`. Sync full, API `listRootFiles` si no hay clone, webhook incremental Bitbucket. Implementación: `index-include-rules.ts`, migración `1744200000000-RepositoryIndexIncludeRules`. Documentación: `MONOREPO_Y_LIMITACIONES_INDEXADO`, `ingestion_flow`, `architecture`, `db_schema`, manuales, `services/ingest/README`.
- **Gobierno de arquitectura (dominios, whitelist proyecto→dominio):** entidades TypeORM `Domain`, `ProjectDomainDependency`, `Project.domainId`; ingest `DomainsService`, `GET /projects/:id/graph-routing` con `cypherShardContexts`; chat/MCP ejecutan Cypher multi-shard con el `cypherProjectId` correcto; frontend `/domains` y pestaña Arquitectura en proyecto (dominio/whitelist). Ver README de `services/ingest`, `services/api`, `services/mcp-ariadne`, `frontend`.
- **Ingest — chat multi-root (Fase 3, primera entrega)** 
 - Inferencia de `repoId` desde mensaje + `project_repositories.role` (`resolve-chat-scope-from-message.util.ts`, `CHAT_INFER_SCOPE_FROM_ROLES`). 
 - Preflight: recorte de filas/contexto cuando el mensaje incluye una ruta que resuelve a un único repo (`chat-preflight-scope.util.ts`, `CHAT_PREFLIGHT_PATH_REPO`). 
 - `ChatRequest`: `clientMeta`, `strictChatScope`; respuesta `[AMBIGUOUS_SCOPE]` cuando hay varios repos sin acotar. 
 - `ProjectsService.getRepositoryRolesContext` para el prompt del sintetizador. 
 - Telemetría `CHAT_TELEMETRY_LOG`: objeto `chat_scope_effective` (preflight, inferencia, alcance). 
 - Documentación: `docs/notebooklm/metricas-alcance-chat.md`; README chat/projects actualizados.
 - Listados íntegros en chat (tablas Markdown, respuesta temprana; topes `CHAT_COMPONENT_FULL_MAX`, `CHAT_GRAPH_INVENTORY_FULL_MAX`).
 - `PATCH /projects/:id/repositories/:repoId` con `{ role }`; UI de rol en detalle de proyecto.
 - Script raíz `pnpm metrics:chat-telemetry` (`scripts/aggregate-chat-telemetry.mjs`).
 - Frontend **ProjectChat**: opción chat amplio (`strictChatScope: false`) con varios repos.
 - Frontend **RepoDetail**: botón **Indexar embeddings** → `POST /repositories/:id/embed-index` (reindexar vectores tras Fase 4 o cambio de modelo).
- **Ingest — Fase 4 (Storybook / markdown en grafo)** 
 - `storybook-documentation.ts`, `storybook-csf-ast.ts`; `parser` + `producer`: `StorybookDoc`, `MarkdownDoc`, enlaces a `Component`/`File`, CSF `STORYBOOK_TARGETS_FILE`. 
 - `sync-path-filter.ts`; listados GitHub/Bitbucket y walk de clone alineados (incl. MDX Storybook, JSON Strapi acotado). 
 - Sync/webhook/shadow: markdown vía parser/producer (sin chunk `Document` por defecto). 
 - `embed-index`: vectores para `StorybookDoc` y `MarkdownDoc`. 
 - Chat `semanticSearchFallback` y MCP `semantic_search`: consultas vectoriales + keyword para docs.
- **Fase 5 (pulido)** 
 - `ariadne-common`: `graph-labels.ts` (`FALKOR_EMBEDDABLE_NODE_LABELS`, `FALKOR_DOCUMENTATION_DOC_LABELS`); ingest `embed-index` crea índices vectoriales iterando esa lista. 
 - `services/cartographer/README.md`: alcance vs ingest canónico. 
 - Raíz `pnpm dev:setup`: añade `pnpm -C frontend install`.
 - Documentación: README raíz (versionado semver); API (autenticación / sin SSO); manuales y `CHAT_Y_ANALISIS` — embed-index y `semantic_search` incluyen Storybook/Markdown.
- **Fase 6 — Analytics multi-root** 
 - Vitest: `services/ingest/src/chat/analytics.service.spec.ts` (`resolveRepositoryIdForAnalysis`, `analyzeByProjectId`). 
 - `services/ingest/README.md`: sección decisiones / contratos Fase 6. 
 - Planes: `PLAN_INCORPORACION_MEJORAS_RELIC_EN_ARIADNE.md` (Fase 6), `Plan_Implementacion_Fase6_AnalyticsService.md`, `Plan_Autonomia_Ariadne.md` actualizados.
 - `GET /projects/:projectId/jobs/:jobId/analysis` — `JobAnalysisService.analyzeJobForProject`; export de `JobAnalysisService` en `RepositoriesModule`; Vitest `job-analysis.service.spec.ts`.
- **Backlog §2 (producto / docs / CI / MCP)** 
 - MCP: caché de herramientas (`get_component_graph`, `get_legacy_impact`, `get_sync_status`) con **memoria por defecto**; Redis solo si `MCP_REDIS_URL` o `REDIS_URL` (o `MCP_REDIS_DISABLED=1` fuerza memoria). Documentado en `services/mcp-ariadne/README.md`. 
 - Docs: `docs/notebooklm/plan-analyze-layer-cache.md`, `docs/notebooklm/diagnostico-layer-dependencies.md` (caché analyze / capas diagnóstico en ingest). 
 - CI: `.github/workflows/ci-ingest-mcp.yml` (Vitest ingest + build MCP). 
 - Frontend **RepoDetail**: `JobAnalysisModal` usa `api.getJobAnalysisByProject` cuando el repo tiene `projectId` / `projectIds`.
 - Frontend **RepoList** (`/repos`): botón **Resync** por fila (`POST /repositories/:id/resync`) sin entrar al detalle.
 - **Indexado:** `sync-path-filter` omite carpetas e2e/playwright/cypress/`__tests_`_/`__mocks__` y `*.e2e.*`; env `**INDEX_E2E=1**` para incluirlas; Vitest `sync-path-filter.spec.ts`.
 - **Frontend:** Vitest (`utils.spec.ts`), Playwright (`e2e/smoke.spec.ts`), `VITE_E2E_AUTH_BYPASS` en `ProtectedRoute`; CI `ci-frontend.yml`; `docs/notebooklm/TESTING.md`.

## [1.2.0] — 2026-04-14

### Added

- **Ingest — Fase 0 migraciones** 
 - `1743200000000-ProjectRepositoryRole`: columna `project_repositories.role` (nullable). 
 - `1743300000000-IndexedFileContentHash`: columna `indexed_files.content_hash` (nullable). 
 - Entidades alineadas; `ProjectsService` expone `role` en repos; plan de modificación usa roles en etiquetas de diagnóstico. 
 - Documentación: `docs/comparativa/MIGRACIONES_CADENA_ARIADNE.md`.
- **Ingest — plan de modificación (multi-root y retrieval)** 
 - Utilidades `modification-plan-resolve`, `modification-plan-scope-cypher`, `modification-plan-terms`, `modification-plan-path-hints`, `modification-plan-path-exclusions`, `markdown-fence`. 
 - `POST /projects/:id/modification-plan`: `currentFilePath`, `questionsMode` (`business` | `technical` | `both`), respuesta con `warnings` y `diagnostic`. 
 - `ProjectsService.resolveRepositoryForWorkspacePath` y resolución `unique` | `ambiguous` en `path-repo-resolution.util.ts`. 
 - Vitest en ingest (`npm test`) y exclusión de `*.spec.ts` del build Nest.
- **MCP** — `get_modification_plan` reenvía `currentFilePath`, `questionsMode` y serializa `warnings` / `diagnostic`.
- **Ingest — Fase 2: análisis con caché, scope y capas de diagnóstico** 
 - Caché LRU y Redis opcional para modos cacheables (`ANALYZE_CACHE_*`, `ANALYZE_CACHE_REDIS_URL` / `REDIS_URL`); respuesta con `reportMeta` (`fromCache`, foco, cobertura, capa extrínseca CALL). 
 - `POST /repositories/:id/analyze` y `POST /projects/:projectId/analyze`: cuerpo con `scope` (alineado con chat) y `crossPackageDuplicates` (modo duplicados); validación de scope (`includePathPrefixes` vacío → 400). 
 - Utilidades y servicios: `analyze-cache.util`, `analyze-distributed-cache.service`, `analyze-focus.util`, `diagnostico-intrinsic-layer`, `diagnostico-validate.util`; límites vía `MAX_ANALYZE_CALL_EDGES` / env relacionados. 
 - `AnalyticsService.analyzeByProjectId` reenvía `analyzeOptions` a `ChatService.analyze`; `POST .../analyze-prep` interno acepta las mismas opciones. 
 - Documentación de API en `services/ingest/src/chat/README.md`; plan de paridad actualizado en `docs/comparativa/PLAN_INCORPORACION_MEJORAS_RELIC_EN_ARIADNE.md`.
- **MCP (`mcp-ariadne`) — `get_project_analysis`** 
 - Argumentos `scope` y `crossPackageDuplicates`; si el ingest devuelve `reportMeta`, la salida incluye el markdown del informe y un bloque JSON con los metadatos.
- **Frontend — panel de analyze** 
 - `api.analyze` / `api.analyzeProject` con body extendido; **RepoChat** y **ProjectChat**: alcance opcional (prefijos / globs), duplicados cross-boundary, badges de caché y foco; en proyecto multi-root, selector de repo para análisis de código.

## [1.1.0] — 2026-03-27

### Added

- **FalkorDB: sharding por dominio (monorepos grandes)** 
 - Modo `domain` vs `project` en `projects` (`falkor_shard_mode`, `falkor_domain_segments`). 
 - Env: `FALKOR_SHARD_BY_DOMAIN`, `FALKOR_AUTO_DOMAIN_OVERFLOW`, `FALKOR_GRAPH_NODE_SOFT_LIMIT`. 
 - Utilidades en `ariadne-common`: `effectiveShardMode`, `domainSegmentFromRepoPath`, `listGraphNamesForProjectRouting`, `shadowGraphNameForSession`, etc. 
 - Migración TypeORM `ProjectFalkorShardRouting`.
- **Espacios de embedding (catálogo multi-modelo)** 
 - Tabla `embedding_spaces` y FKs `read_embedding_space_id` / `write_embedding_space_id` en `repositories`. 
 - API `GET|POST /embedding-spaces`, DTO `CreateEmbeddingSpaceDto`, servicio `EmbeddingSpaceService`. 
 - Utilidad `graph-property.util` para alinear propiedades del grafo con espacios vectoriales. 
 - Proveedor **Ollama** para embeddings locales. 
 - Migración `EmbeddingSpaces`.
- **Ingest — chat e integración con orquestador** 
 - `ChatRetrieverToolsService`: herramientas del retriever sin pasar por el LLM del ingest. 
 - Controllers internos `InternalChatToolsController`, `InternalProjectToolsController` bajo `InternalApiGuard` (red Docker / orchestrator). 
 - Refuerzo del `ChatService` y handlers para flujos analyze / scope.
- **Orchestrator — módulo `codebase-chat`** 
 - Cliente HTTP al ingest (`IngestChatClient`), capa LLM (`OrchestratorLlmService`). 
 - Endpoints de chat, análisis de codebase y plan de modificación (`Codebase*Controller` / `*Service`). 
 - Utilidades de scope y constantes dedicadas.
- **API grafo** 
 - Mejoras en `GraphService` / `GraphController`: resolución de nodos multi-repo, saneo de escalares Falkor, rutas y OpenAPI actualizados. 
 - `FalkorService` y caché alineados con partición y rutas de grafo.
- **Infra** 
 - Variables de entorno de sharding en `docker-compose` para api / ingest / mcp según servicio.

### Changed

- **Sync (`ingest`)**: lógica ampliada para coordinar índice, repositorios y rutas Falkor con los nuevos modos de partición y espacios de embedding. 
- **Shadow service**: alineación con nombres de grafo por sesión. 
- **Proyectos y repositorios**: campos y DTOs para shard Falkor y referencias a espacios de embedding. 
- **Proveedores de embedding** (Google, OpenAI): ajustes para encajar en el catálogo de espacios y configuración. 
- `**mcp-ariadne`**: herramientas y resolución Falkor multi-grafo / listado de candidatos para routing MCP. 
- `**packages/ariadne-common**`: contrato público ampliado (`index` exporta nuevas utilidades Falkor). 
- **Redis state / workflow (orchestrator)**: extensiones para soportar flujos del codebase-chat.

### Fixed

- Corrección de representación de propiedades de nodos Falkor que llegaban como objetos (evita `"[object Object]"` en IDs y aristas en UI/API). 
- IDs estables de nodos en vistas de grafo cuando hay colisiones de `name` entre repos (`projectId` / `repoId` / `path` en clave compuesta).

### Impacto arquitectónico

- **Grafo de dependencias**: aparece un eje **orchestrator → ingest** explícito (HTTP interno + herramientas retriever), además del flujo existente ingest → Falkor/Postgres. 
- **Falkor**: de un grafo lógico por proyecto puede derivarse un **conjunto de grafos** por segmento de ruta; API, MCP e ingest deben acordar `projectId`, modo de shard y segmentos conocidos. 
- **Datos**: nuevas tablas/columnas exigen **migraciones** antes de desplegar; re-sync recomendable tras activar `domain` u overflow automático. 
- **Embeddings**: desacoplamiento modelo/proveedor vía `embedding_spaces` y asociación por repositorio (lectura/escritura), moviendo el sistema hacia multi-tenant vectorial sin reemplazar el índice existente de golpe.

---

## [1.0.0] — línea base previa

Versión documentada en `package.json` de servicios (`1.0.0`) antes de este release: ingest orchestration, API grafo, MCP, Falkor por proyecto (`FALKOR_SHARD_BY_PROJECT`), sin espacios de embedding persistidos ni sharding por dominio en BD.