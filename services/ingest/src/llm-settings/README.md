# LLM Settings (`llm-settings`)

Global deployment-wide LLM configuration persisted in Postgres and editable from the Ariadne UI (**Ajustes**, admin-only).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/llm-settings/catalog` | admin | Provider catalog (labels, default models, capabilities) |
| GET | `/llm-settings` | admin | Effective config (masked API key hint) |
| PUT | `/llm-settings` | admin | Upsert singleton row `id=default` |
| POST | `/llm-settings/test` | admin | Minimal chat completion against provider |
| GET | `/internal/llm-runtime` | internal (Docker) | Full runtime for orchestrator (includes decrypted key) |

Proxied to the browser via API gateway: `/api/llm-settings/*`.

## Persistence

- Table: `llm_settings` — migration `1746600000000-LlmSettingsChatAgents` adds `orchestrator_router_model`, `orchestrator_worker_model`, `chat_intent_router_enabled`.
- API key: AES-256-GCM via [`credentials/crypto.util.ts`](../credentials/crypto.util.ts) + `CREDENTIALS_ENCRYPTION_KEY`.

## Runtime resolution

Priority: **DB (Ajustes)** → **`LLM_*` env vars**.

- Ingest: [`active-llm-config.ts`](./active-llm-config.ts) hydrated on module init and after each `PUT`.
- [`llm/llm-config.ts`](../llm/llm-config.ts) reads the active singleton synchronously for chat and embeddings.
- Orchestrator: fetches `GET /internal/llm-runtime` with TTL cache — includes `orchestratorRouterModel`, `orchestratorWorkerModel`, `chatIntentRouterEnabled` for the multi-agent chat pipeline.

## Chat multi-agente (Ajustes UI)

| Campo BD | Rol |
|----------|-----|
| `orchestrator_router_model` | Clasificación de intención + auditoría de reingeniería |
| `orchestrator_worker_model` | Retrieve con tools + síntesis Q&A |
| `chat_intent_router_enabled` | Si `false`, solo heurística por keywords |

Vacío en router/worker → mismo que `orchestrator_chat_model` (o `chat_model` ingest).

## Providers

Catalog in [`llm-catalog.ts`](./llm-catalog.ts): `openrouter`, `openai`, `anthropic`, `gemini`, `groq`, `cloudflare` — all via OpenAI-compatible `/chat/completions`.
