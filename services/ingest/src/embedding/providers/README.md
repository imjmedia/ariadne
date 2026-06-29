# Proveedores de embedding

| Provider | Env | Dimensión default | API |
|----------|-----|-------------------|-----|
| **openrouter** (default) | `LLM_API_KEY`, `LLM_EMBEDDING_MODEL`, `LLM_EMBEDDING_DIM` | 1536 | `POST /v1/embeddings` (OpenAI-compatible) |
| **ollama** (local dev) | `OLLAMA_BASE_URL`, `OLLAMA_EMBED_MODEL`, `LLM_EMBEDDING_DIM` | 768 (`nomic-embed-text`) | `POST /api/embeddings` |

## OpenRouter

Configuración: `OPENROUTER_API_KEY`, `OPENROUTER_EMBEDDING_MODEL` (default `openai/text-embedding-3-small`), `LLM_EMBEDDING_DIM` (default 1536). Ver `../llm/llm-config.ts` y `openrouter.provider.ts`.

`EMBEDDING_PROVIDER=openrouter` (o `openai` como alias) en el entorno.

## Ollama (offline / dev)

```bash
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
LLM_EMBEDDING_DIM=768
```

Pull the model once: `ollama pull nomic-embed-text`.

**Importante:** la dimensión vectorial debe coincidir con `LLM_EMBEDDING_DIM` y con la fila en `embedding_spaces`. Cambiar de OpenRouter (1536) a Ollama (768) requiere un espacio vectorial distinto o re-embed completo.

Si Ollama no está disponible, el provider falla con error explícito (no hay fallback silencioso a OpenRouter).

## Docker Compose (dev)

Perfil opcional `embed-local` en `docker-compose.dev.yml` levanta el servicio `ollama`.
