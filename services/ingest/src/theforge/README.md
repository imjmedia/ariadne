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

**Env (server):**

- `THEFORGE_API_URL` — base URL of The Forge API (e.g. `https://api.example.com`)
- `THEFORGE_SERVICE_JWT` — default service token when per-repo token is empty

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
- `GET /theforge-integration/brownfield-projects` — Selector LEGACY para vincular proyecto Ariadne
- `GET/PUT /theforge-integration` — admin (Ajustes)
- `PUT /projects/:id/theforge-link` — Vincula proyecto Ariadne ↔ Forge (propaga `theforge_project_id` a repos)
- `DELETE /projects/:id/theforge-link` — Desvincula
- `GET /conversations/:id/forge-promotion`, preview, promote — solo si integración activa

**Contratos:** `docs/contracts/theforge-create-stage-from-pack-v1.md`, `docs/contracts/theforge-resolve-ariadne-link-v1.md`, `docs/contracts/change-promotion-pack-v1.md`.

**HTTP (The Forge):**

- `POST /theforge/resolve-forge-project-for-ariadne`
- `POST /theforge/create-stage-from-ariadne-change-pack`

Mapper: `forge-create-stage.mapper.ts` (pack interno v1.1 → Forge `pack.version: "1"`).

El pack incluye `graphEvidenceBundle` + `changePlanSeed`. Handoff a Forge: `modification_plan_enriched`, `change_plan_seed`, y si hay `migration_tasks` → `post_deliverable_gate` (Forge debe validar con Ariadne `POST /projects/:id/validate-tasks-json` tras `legacy_generate_deliverables`).

