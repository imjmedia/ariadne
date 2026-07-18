# LLM del orchestrator

Todo el tráfico sale por **OpenRouter** (API compatible OpenAI), alineado con **The Forge**.

## Configuración

| Fuente | Rol |
|--------|-----|
| **Ajustes (BD)** | API key, proveedor, modelos chat/router/worker — pantalla **Plataforma → Ajustes → Proveedores IA**. |
| **`GET ingest/internal/llm-runtime`** | Orchestrator obtiene runtime descifrado (cache TTL 45 s). Tras `PUT` Ajustes, ingest llama `POST /internal/llm-runtime/invalidate`. |
| **`LLM_*` env** | Solo defaults de modelo/URL/temperatura si no hay fila en BD. **No usar `LLM_API_KEY` (deprecada).** |

| Variable env | Rol |
|--------------|-----|
| `INGEST_URL` | Obligatoria en Docker (`http://ingest:3002`) para leer Ajustes. |
| `LLM_BASE_URL` | Default `https://openrouter.ai/api/v1`. |
| `LLM_CHAT_MODEL` / `ORCHESTRATOR_LLM_MODEL` | Modelo global si Ajustes vacío. |
| `LLM_HTTP_REFERER` / `LLM_APP_TITLE` | Cabeceras opcionales de OpenRouter. |
| `LLM_TEMPERATURE` | Temperatura (default 0.1). |
| `LLM_MAX_CONCURRENT` | Máximo de llamadas LLM concurrentes (default 1). |
| `LLM_MIN_REQUEST_INTERVAL_MS` | Intervalo mínimo entre requests (default 2000 ms). |
| `LLM_THROTTLE_DISABLED` | `1` / `true` desactiva throttling. |

`orchestrator-llm.facade.ts` envuelve las llamadas con `llm-request-throttle.ts`.

## Archivos

- `llm-settings.client.ts` — Fetch runtime desde ingest; `ensureOrchestratorLlmRuntime()` antes de cada llamada.
- `llm-config.ts` — Base URL, clave, cabeceras OpenRouter (desde runtime cacheado).
- `llm-unified.ts` — Resolución de modelo (runtime). Variables env solo como fallback de modelo.
- `orchestrator-llm-config.ts` — `hasOrchestratorLlmConfigured`, `orchestratorLlmModel()`.
- `llm.adapter.ts` — Cliente HTTP a `/v1/chat/completions`.
- `orchestrator-llm.facade.ts`, `llm-request-throttle.ts`, `llm-token-estimate.ts`, `moonshot-rate-limit.error.ts`.
