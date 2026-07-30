# The Forge integration (ingest)

## Brownfield converge after reindex

Per-repository config on `repositories`:

| Column | Purpose |
|--------|---------|
| `theforge_project_id` | The Forge `Project.id` for `POST /projects/:id/converge/trigger` |
| `theforge_stage_id` | Optional `?stageId=` query |
| `theforge_converge_persist` | Body `{ persist: true/false }` |
| `theforge_converge_trigger_mode` | `off` \| `full` \| `incremental` \| `all` |
| `theforge_service_token_encrypted` | Optional Bearer JWT (encrypted); fallback `THEFORGE_SERVICE_JWT` |

**URL y JWT (servidor):**

- **Ajustes → The Forge → URL** — base REST (`…/api`) o MCP Streamable HTTP (`…/mcp`)
- **Ajustes → Token/JWT** — Secret MCP o JWT sesión (modo `/mcp`); JWT servicio REST (modo `/api`)
- `THEFORGE_API_URL` — fallback de URL si no hay valor guardado en Ajustes
- Token por repo (`theforge_service_token_encrypted`) — override opcional del JWT global

**Modos de transporte**

| URL configurada | Transporte | Catálogo brownfield / promoción chat |
|-----------------|------------|--------------------------------------|
| `…/mcp` | MCP (`tools/call`) | `list_projects`, `resolve_forge_project_for_ariadne`, `create_stage_from_ariadne_change_pack` |
| `…/api` | REST HTTP | `GET /projects`, `POST /theforge/*` |

Brownfield **converge** post-sync sigue usando REST (`POST …/projects/:id/converge/trigger`); en modo MCP solo requiere JWT REST si se activa converge por repo.

**Hook points:** `SyncService.runFullSync` (full/resync) and `WebhooksService.handleBitbucketPush` (incremental) call `TheForgeConvergeService.triggerAfterSync` after a successful job. Failures are logged only; they do not fail the sync.

See `docs/notebooklm/BROWNFIELD-CONVERGE-THEFORGE.md`.

## Chat → The Forge (change promotion, opcional)

Integración **opt-in** en **Ajustes (admin)**. Ariadne OSS no requiere The Forge.

| Env / Ajustes | Purpose |
|-----|---------|
| Ajustes → habilitar + URL API | Activa botón en chat y promoción |
| `THEFORGE_API_URL` | Fallback de URL al guardar (no activa solo por env) |
| `THEFORGE_SERVICE_JWT` | Fallback JWT servicio |
| `THEFORGE_PROMOTE_MOCK=true` | Mock resolve + create (dev/E2E) |

**Endpoints (ingest):**

- `GET /theforge-integration/status` — UI chat / proyectos (¿mostrar botón?)
- `GET /theforge-integration/brownfield-projects` — Selector LEGACY (MCP `list_projects` si URL termina en `/mcp`; si no REST `GET /projects`)

**Troubleshooting selector vacío**

| Síntoma | Causa habitual |
|---------|----------------|
| `401` en `/api/projects` con URL `/mcp` | Versión antigua reescribía a REST; actualiza ingest: con `/mcp` debe usar MCP |
| `503` + Method Not Allowed | URL `/mcp` usada como REST directo (legacy) |
| `FORGE_WRONG_API_URL` | URL devuelve HTML (SPA) o apunta a Ariadne |
| Lista vacía | Token sin acceso a Workshop o filas sin `projectType`/`stages[].isLegacy` |
| `503 FORGE_NO_SERVICE_TOKEN` | Falta token en Ajustes o `THEFORGE_SERVICE_JWT` |

La vinculación usa **MCP** (`…/mcp` + Secret MCP/JWT) o **REST** (`…/api` + JWT servicio), según la URL en Ajustes.

**Endpoints (ingest, cont.):**
- `GET/PUT /theforge-integration` — admin (Ajustes)
- `PUT /projects/:id/theforge-link` — Vincula proyecto Ariadne ↔ Forge (propaga `theforge_project_id` a repos)
- `DELETE /projects/:id/theforge-link` — Desvincula
- `POST /projects/:id/theforge-stage/preview` — Vista previa: descripción del trabajo + `# Tasks` (YAML/checklist)
- `POST /projects/:id/theforge-stage` — Crea etapa en Forge vinculado con handoff `change_work_description` + `cursor_tasks_markdown`
- `GET /projects/:id/integration-handoffs/sources` — Proyectos NEW con handoffs (`integrationHandoff`)
- `POST /projects/:id/integration-handoffs/import` — Importa handoffs `sent` → chats agrupados por lote
- `POST /integration-batches/:id/preview-theforge-pack` — Fusiona chats del lote + genera pack enriquecido (se cachea en DB)
- `POST /integration-batches/:id/promote-to-theforge` — Reutiliza pack cacheado si la vista previa coincide; crea etapa LEGACY
- `DELETE /integration-batches/:id` — Elimina el lote y todas sus conversaciones (permite re-importar handoffs)
- `GET /conversations/:id/forge-promotion`, preview, promote — solo si integración activa; usa `theforgeProjectId` vinculado antes de `resolve_forge_project_for_ariadne`

**Contratos:** `docs/contracts/theforge-create-stage-from-pack-v1.md`, `docs/contracts/theforge-resolve-ariadne-link-v1.md`, `docs/contracts/change-promotion-pack-v1.md`.

**HTTP (The Forge):**

- `POST /theforge/resolve-forge-project-for-ariadne`
- `POST /theforge/create-stage-from-ariadne-change-pack`

Mapper: `forge-create-stage.mapper.ts` (pack interno v1.1 → Forge `pack.version: "1"`).

El pack incluye `graphEvidenceBundle` + `changePlanSeed`. Handoff a Forge: `modification_plan_enriched`, `change_plan_seed`, **`change_work_description`** (markdown), **`cursor_tasks_markdown`** (`# Tasks` con secciones Backend/Frontend/Infra/Testing/Deploy), y si hay `migration_tasks` → `post_deliverable_gate` (Forge debe validar con Ariadne `POST /projects/:id/validate-tasks-json` tras `legacy_generate_deliverables`).

Generación de tareas: `cursor-tasks-document.service.ts` (LLM con prompt estricto + fallback determinista desde `changePlanSeed`). Validación estructural en `cursor-tasks-document.util.ts`.

**Promoción de lote (batch) — timeouts y caché**

| Variable | Default | Uso |
|----------|---------|-----|
| `THEFORGE_CREATE_STAGE_TIMEOUT_MS` | 600000 (10 min) | `create_stage_from_ariadne_change_pack` (HTTP o MCP) |
| `THEFORGE_REQUEST_TIMEOUT_MS` | 120000 | resolve / llamadas ligeras |
| `FORGE_PROMOTION_PENDING_TTL_MS` | 900000 (15 min) | Permite reintentar si quedó `pending` tras timeout |
| `INGEST_PROXY_TIMEOUT_MS` (API) | 600000 | Proxy `/api/integration-batches/*` → ingest |

Flujo recomendado: **Aplicar cambios** (preview) → **Enviar lote**. El preview guarda `forge_preview_pack` en Postgres; promote no reconstruye el pack si nombre/entregables/chats no cambiaron.

| Síntoma | Causa habitual |
|---------|----------------|
| Barra ~92% mucho rato | Normal: la barra es estimada; la llamada real es `createStageFromChangePack` (puede tardar minutos) |
| `500` / `502` / `504` tras espera | Timeout Traefik/nginx/API antes de ingest; sube `INGEST_PROXY_TIMEOUT_MS` y timeout del reverse proxy externo |
| `503 FORGE_CREATE_STAGE_TIMEOUT` | Forge no respondió en 10 min |
| `409` promoción en curso | Lote en `forgePromotionStatus=pending`; espera 15 min o redeploy con TTL |
| Preview OK, promote lento | Versión antigua reconstruía pack dos veces; actualiza ingest con caché de preview |

