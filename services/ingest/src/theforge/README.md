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

- **Ajustes → The Forge → URL API** — base REST usada por catálogo brownfield, promoción chat y **converge post-sync**
- **Ajustes → JWT de servicio** — Bearer por defecto (fallback `THEFORGE_SERVICE_JWT`)
- `THEFORGE_API_URL` — fallback de URL si no hay valor guardado en Ajustes
- Token por repo (`theforge_service_token_encrypted`) — override opcional del JWT global

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
- `GET /theforge-integration/brownfield-projects` — Selector LEGACY para vincular proyecto Ariadne (REST a The Forge `GET /projects` Workshop; detecta LEGACY por `projectType`, alias `BROWNFIELD`, o `stages[].isLegacy`)

**Troubleshooting selector vacío**

| Síntoma | Causa habitual |
|---------|----------------|
| `503` + Method Not Allowed | `THEFORGE_API_URL` apuntaba a `/mcp`; Ariadne normaliza a `…/api` |
| `FORGE_WRONG_API_URL` | URL devuelve HTML (SPA) o apunta a Ariadne; usar base Nest `…/api` |
| Lista vacía | JWT sin acceso a Workshop o filas sin `projectType`/`stages[].isLegacy` |
| `503 FORGE_NO_SERVICE_TOKEN` | Falta JWT en Ajustes o `THEFORGE_SERVICE_JWT` |

La vinculación usa **HTTP** (URL API de Ajustes + Bearer servicio), no el MCP de The Forge en Cursor.

**Endpoints (ingest, cont.):**
- `GET/PUT /theforge-integration` — admin (Ajustes)
- `PUT /projects/:id/theforge-link` — Vincula proyecto Ariadne ↔ Forge (propaga `theforge_project_id` a repos)
- `DELETE /projects/:id/theforge-link` — Desvincula
- `POST /projects/:id/theforge-stage/preview` — Vista previa: descripción del trabajo + `# Tasks` (YAML/checklist)
- `POST /projects/:id/theforge-stage` — Crea etapa en Forge vinculado con handoff `change_work_description` + `cursor_tasks_markdown`
- `GET /conversations/:id/forge-promotion`, preview, promote — solo si integración activa (también genera documentos al promover)

**Contratos:** `docs/contracts/theforge-create-stage-from-pack-v1.md`, `docs/contracts/theforge-resolve-ariadne-link-v1.md`, `docs/contracts/change-promotion-pack-v1.md`.

**HTTP (The Forge):**

- `POST /theforge/resolve-forge-project-for-ariadne`
- `POST /theforge/create-stage-from-ariadne-change-pack`

Mapper: `forge-create-stage.mapper.ts` (pack interno v1.1 → Forge `pack.version: "1"`).

El pack incluye `graphEvidenceBundle` + `changePlanSeed`. Handoff a Forge: `modification_plan_enriched`, `change_plan_seed`, **`change_work_description`** (markdown), **`cursor_tasks_markdown`** (`# Tasks` con secciones Backend/Frontend/Infra/Testing/Deploy), y si hay `migration_tasks` → `post_deliverable_gate` (Forge debe validar con Ariadne `POST /projects/:id/validate-tasks-json` tras `legacy_generate_deliverables`).

Generación de tareas: `cursor-tasks-document.service.ts` (LLM con prompt estricto + fallback determinista desde `changePlanSeed`). Validación estructural en `cursor-tasks-document.util.ts`.

