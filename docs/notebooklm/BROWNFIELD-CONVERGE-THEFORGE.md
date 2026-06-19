# Brownfield converge — Ariadne → The Forge

Cadena automática **reindex (Ariadne) → converge (The Forge)** para proyectos legacy brownfield.

## Flujo

```text
push Bitbucket/GitHub
  → Ariadne webhook incremental (o resync manual)
  → grafo FalkorDB actualizado
  → (opcional) TheForgeConvergeService
  → POST {THEFORGE_API_URL}/projects/{theforgeProjectId}/converge/trigger
  → (opcional) webhook saliente configurado en The Forge
```

Ariadne **no** sustituye el webhook saliente de The Forge (`convergeWebhookUrl`); lo **antecede** con el reindex para que `ask_codebase` en converge tenga evidencia fresca.

## Configuración por repositorio

UI: **Repos → Editar → Brownfield converge (The Forge)**.

| Campo | Columna BD | Descripción |
|-------|------------|-------------|
| The Forge project ID | `theforge_project_id` | UUID del proyecto legacy en The Forge |
| Stage ID | `theforge_stage_id` | Opcional; query `?stageId=` |
| Cuándo disparar | `theforge_converge_trigger_mode` | `off` \| `incremental` \| `full` \| `all` |
| Persistir tareas | `theforge_converge_persist` | Body `{ persist: true }` |
| JWT servicio | `theforge_service_token_encrypted` | Bearer; cifrado AES-GCM |

### Modos de disparo

| Modo | Cuándo |
|------|--------|
| `off` | Nunca (default) |
| `incremental` | Tras webhook Bitbucket / sync incremental |
| `full` | Tras `POST /repositories/:id/resync` o full sync en cola |
| `all` | Cualquier sync exitoso |

## Variables de entorno (ingest)

```bash
THEFORGE_API_URL=https://api.theforge.example   # base URL API (sin / final)
THEFORGE_SERVICE_JWT=eyJ...                     # fallback si el repo no tiene token propio
```

## API

`PATCH /repositories/:id` acepta los mismos campos que la UI (sin devolver el JWT cifrado).

## Errores

El hook **no falla** el job de sync si The Forge responde 4xx/5xx o hay timeout; solo log `warn`. Revisá logs del ingest.

## Referencias

- The Forge: `docs/notebooklm/CONVERGE-WEBHOOK-CI-GUIDE.md`, ayuda Workshop **Webhook converge (CI)**
- Código: `services/ingest/src/theforge/theforge-converge.service.ts`
