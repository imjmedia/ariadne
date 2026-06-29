# Guía de pruebas — Camino D (CBM parity, fases 1–4)

Guía operativa para validar las fases **1.1** (`query_graph`), **1.2** (`detect_changes`), **2** (embeddings Ollama), **3** (graph artifact export/import) y **4** (benchmark CALLS) del plan [PLAN_CBM_PARITY_CAMINO_D.md](PLAN_CBM_PARITY_CAMINO_D.md).

---

## Prerrequisitos

### Stack Docker (desarrollo local)

Levantar infraestructura y servicios con el overlay de dev:

```bash
pnpm install
cp .env.example .env   # ajustar LLM, credenciales, etc.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

**Puertos expuestos en el host** (`docker-compose.dev.yml`):

| Servicio | Puerto host | Notas |
| -------- | ----------- | ----- |
| FalkorDB | **6379** | Grafo de código |
| PostgreSQL | **5432** | Metadatos repos/sync |
| Redis (BullMQ) | **6380** → 6379 contenedor | Cola de sync |
| API Nest | **3000** | `/api/*`, auth OTP |
| Ingest | **3002** | Sync, chat, detect-changes, graph artifact |
| Orchestrator | **3001** | Chat multi-repo |
| MCP Streamable HTTP | **127.0.0.1:9888** → 8080 | Cursor: `http://127.0.0.1:9888/mcp` |
| Frontend | **5173** → 80 | UI admin |
| Ollama (opcional) | **11434** | Perfil `embed-local` |

Ollama solo si pruebas Fase 2 con contenedor:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile embed-local up -d ollama
ollama pull nomic-embed-text   # en el host o dentro del contenedor
```

### Requisitos adicionales

| Requisito | Detalle |
| --------- | ------- |
| Node.js | ≥ 20 |
| Repo indexado | Al menos un repositorio con **full sync** completado (Falkor con nodos) |
| `projectId` / `repoId` | UUID desde UI (`/repos`) o `GET http://localhost:3002/repositories` |
| MCP local | En dev, `MCP_HTTP_ALLOW_UNAUTHENTICATED=true` (default en compose dev) — no hace falta Bearer en curl local |

Variables relevantes (ver también [.env.example](../../.env.example) y [CONFIGURACION_Y_USO.md](../manual/CONFIGURACION_Y_USO.md)):

| Variable | Fase | Propósito |
| -------- | ---- | --------- |
| `FALKOR_SHARD_BY_PROJECT` | 1–4 | Si `true`, `query_graph` y Cypher exigen `projectId` |
| `INGEST_URL` | MCP | Default `http://localhost:3002` — routing de grafo |
| `EMBEDDING_PROVIDER=ollama` | 2 | Proveedor local de vectores |
| `OLLAMA_BASE_URL` | 2 | Default `http://localhost:11434` |
| `OLLAMA_EMBED_MODEL` | 2 | Default `nomic-embed-text` |
| `LLM_EMBEDDING_DIM` | 2 | Default **768** con Nomic |
| `GRAPH_ARTIFACT_EXPORT_ON_SYNC` | 3 | `1`/`true`: exporta artifact tras full sync |
| `GRAPH_ARTIFACT_FORCE_IMPORT` | 3 | `1`/`true`: reimporta aunque Falkor ya tenga nodos |

---

## Orden de pruebas (smoke → integración)

1. **Smoke (5 min)** — Infra levantada, health, un repo sincronizado (ver checklist al final).
2. **Tests automatizados** — Vitest ingest + specs `cypher-guard` / `diff-impact` en `ariadne-common`.
3. **Fase 1.1** — `query_graph` vía MCP (lectura Cypher + guard).
4. **Fase 1.2** — `detect_changes` MCP + `POST /repositories/:id/detect-changes`.
5. **Fase 2** — Embeddings Ollama + `embed-index` (opcional si ya usáis OpenRouter).
6. **Fase 3** — Export/import graph artifact (requiere clone + credenciales Git).
7. **Fase 4** — Script benchmark CALLS contra repo indexado.

Cada fase asume que la anterior no falla de forma bloqueante (p. ej. Fase 4 requiere grafo con aristas `CALLS`).

---

## Tests automatizados

### Monorepo (Vitest)

```bash
# Ingest (incluye graph-artifact, ollama.provider, sync, chat, …)
pnpm test:ingest

# Solo specs de artifact Camino D
pnpm -C services/ingest test -- --run src/artifact/graph-artifact.spec.ts
pnpm -C services/ingest test -- --run src/embedding/providers/ollama.provider.spec.ts

# Frontend unitario (opcional, no Camino D)
pnpm test:unit
```

### `cypher-guard` y `diff-impact` (`ariadne-common`)

Estos specs usan el runner nativo de Node (no Vitest):

```bash
node --experimental-strip-types --test packages/ariadne-common/src/cypher-guard.spec.ts
node --experimental-strip-types --test packages/ariadne-common/src/diff-impact.spec.ts
```

**Qué cubren:**

- **cypher-guard:** bloqueo de `MERGE`, `CREATE`, `DELETE`, `SET`, `REMOVE`, `DROP`, `CALL {`; inyección de `projectId`; `LIMIT` por defecto.
- **diff-impact:** modos `staged` / `unstaged` / `all`, parsing de símbolos en unified diff, clasificación de riesgo.

### MCP (verificación mínima)

```bash
pnpm -C services/mcp-ariadne build
```

CI: `.github/workflows/ci-ingest-mcp.yml` (Vitest ingest + build MCP). Ver [TESTING.md](TESTING.md).

---

## Fase 1.1 — `query_graph` (Cypher read-only)

**Implementación:** `packages/ariadne-common/src/cypher-guard.ts`, handler en `services/mcp-ariadne/src/index.ts`.

### Comportamiento esperado

- Solo consultas **lectura** (`MATCH` / `RETURN`).
- Rechaza cláusulas de escritura/destructivas.
- Con `FALKOR_SHARD_BY_PROJECT=true`, **`projectId` obligatorio** (UUID de proyecto o `roots[].id` del repo).
- Añade `LIMIT` si falta (default **50**, máximo **500**).
- Respuesta JSON: `{ query, rowCount, limit, injectedProjectScope, appendedLimit, rows }`.

### MCP — ejemplo JSON (`tools/call`)

Sustituye `<REPO_UUID>` por el id del repositorio en Ariadne.

```bash
curl -s -X POST http://127.0.0.1:9888/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "query_graph",
      "arguments": {
        "projectId": "<REPO_UUID>",
        "query": "MATCH (f:Function) RETURN f.name AS name, f.path AS path",
        "limit": 10
      }
    }
  }'
```

**Consultas útiles de validación:**

```cypher
# Conteo de funciones del repo
MATCH (f:Function) WHERE f.repoId = $repoId RETURN count(f) AS cnt

# Dead code (sin CALLS entrantes) — Falkor soporta NOT EXISTS { … }
MATCH (f:Function) WHERE NOT EXISTS { (f)<-[:CALLS]-() } RETURN f.name LIMIT 20

# Callers de un símbolo
MATCH (caller)-[:CALLS]->(callee:Function {name: $name}) RETURN caller.name, caller.path LIMIT 20
```

(Para las dos últimas, el guard inyectará `projectId` si no está en la query.)

### Prueba negativa (guard)

```bash
curl -s -X POST http://127.0.0.1:9888/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "query_graph",
      "arguments": {
        "projectId": "<REPO_UUID>",
        "query": "MERGE (n:File {path: \"evil.ts\"}) RETURN n"
      }
    }
  }'
```

Esperado: `isError: true` y texto `Blocked write/destructive Cypher clause: MERGE`.

---

## Fase 1.2 — `detect_changes` (blast radius)

**Implementación:** `packages/ariadne-common/src/diff-impact.ts`, `services/ingest/src/analysis/detect-changes.service.ts`, MCP `services/mcp-ariadne/src/detect-changes-handler.ts`.

### Endpoint ingest

```http
POST /repositories/:id/detect-changes
Content-Type: application/json

{
  "mode": "staged",
  "diff": "<salida cruda de git diff --cached>"
}
```

| Campo | Obligatorio | Valores |
| ----- | ----------- | ------- |
| `diff` | **Sí** | Unified git diff (generar en local) |
| `mode` | No | `staged` (default), `unstaged`, `all` |
| `baseRef` | No | Reservado; el diff ya debe venir generado |

**Ejemplo curl:**

```bash
REPO_ID="<UUID>"
DIFF="$(git diff --cached)"
curl -s -X POST "http://localhost:3002/repositories/${REPO_ID}/detect-changes" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg diff "$DIFF" --arg mode staged '{mode: $mode, diff: $diff}')"
```

**Respuesta esperada (JSON):**

```json
{
  "mode": "staged",
  "changedFiles": ["src/foo.ts"],
  "affectedSymbols": [
    {
      "name": "MyComponent",
      "changeType": "Modificación",
      "impact": "12 dependientes en grafo",
      "risk": "ALTO",
      "dependentCount": 12
    }
  ],
  "summary": { "high": 1, "medium": 0, "low": 0 },
  "projectId": "...",
  "repositoryId": "..."
}
```

El blast radius usa Cypher: `(n {name})<-[:CALLS|RENDERS*]-(dep)` acotado por `projectId`.

### MCP — `detect_changes`

Modos: **`staged`** (`git diff --cached`), **`unstaged`** (`git diff`), **`all`** (`git diff HEAD`).

**Opción A — MCP con acceso al filesystem del repo:**

```bash
curl -s -X POST http://127.0.0.1:9888/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-03-26" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "detect_changes",
      "arguments": {
        "projectId": "<REPO_UUID>",
        "mode": "staged",
        "workspaceRoot": "/ruta/absoluta/al/repo"
      }
    }
  }'
```

**Opción B — MCP remoto (pasar diff explícito):**

```bash
DIFF="$(git -C /ruta/al/repo diff --cached | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
# Construir el body con "diff": <string escapado> en el JSON de tools/call
```

**Alias deprecado:** `analyze_local_changes` — mismo flujo pero respuesta **Markdown** (usar `detect_changes` para JSON).

---

## Fase 2 — Embeddings Ollama

**Implementación:** `services/ingest/src/embedding/providers/ollama.provider.ts`, perfil Docker `embed-local`.

### Configuración

```bash
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
LLM_EMBEDDING_DIM=768
```

Reiniciar ingest tras cambiar variables. Pull del modelo:

```bash
ollama pull nomic-embed-text
```

### Validación manual

1. Comprobar que Ollama responde:

   ```bash
   curl -s http://localhost:11434/api/tags | jq .
   ```

2. Probar embedding directo:

   ```bash
   curl -s http://localhost:11434/api/embeddings \
     -H "Content-Type: application/json" \
     -d '{"model":"nomic-embed-text","prompt":"test"}' | jq '.embedding | length'
   ```

   Debe devolver **768** (o la dimensión configurada).

3. Reindexar vectores del repo:

   ```bash
   curl -X POST "http://localhost:3002/repositories/<REPO_UUID>/embed-index"
   ```

**Importante:** cambiar de OpenRouter/OpenAI (1536 dims) a Ollama (768) exige espacio vectorial distinto o re-embed completo. Ver `services/ingest/src/embedding/README.md`.

---

## Fase 3 — Graph artifact (export / import)

**Implementación:** `services/ingest/src/artifact/graph-export.service.ts`, `graph-import.service.ts`, integrado en el pipeline de sync.

### Export explícito

```bash
curl -X POST "http://localhost:3002/repositories/<REPO_UUID>/export-graph-artifact" \
  -H "Content-Type: application/json" \
  -d '{"tier":"best"}'
```

| Campo body | Default | Descripción |
| ---------- | ------- | ----------- |
| `tier` | `best` | `fast` (zstd-3) o `best` (zstd-9) |
| `projectId` | inferido | UUID proyecto si el repo está en varios |

El servicio clona el repo (credenciales en BD), escribe en el workdir del clone:

- `.ariadne/graph-<repoId>.jsonl.zst`
- `.ariadne/manifest.json` (SHA-256, conteos, `commitSha`, `exportedAt`)
- Añade `*.zst merge=ours` a `.gitattributes` en la primera exportación

**Export automático tras sync:** `GRAPH_ARTIFACT_EXPORT_ON_SYNC=1` en ingest.

### Import en bootstrap de sync

Condiciones (ver `graph-import.service.ts`):

1. Existen artifact + manifest en el clone.
2. SHA-256 del manifest coincide con el archivo.
3. Falkor **vacío** para ese repo **o** `GRAPH_ARTIFACT_FORCE_IMPORT=1`.
4. Si `manifest.commitSha === HEAD`, puede omitirse la fase de reescritura del grafo (bootstrap rápido).

**Prueba de integración sugerida:**

1. Exportar desde entorno A (grafo poblado).
2. Copiar `.ariadne/` al repo (opcional commit; por defecto no se versiona).
3. En entorno B con Falkor vacío para ese repo, lanzar **full sync**.
4. Verificar nodos en UI Grafo o con `query_graph` (`MATCH (n) WHERE n.repoId = $repoId RETURN count(n)`).

---

## Fase 4 — Benchmark resolución CALLS

**Documentación:** [BENCHMARK_CALLS_RESOLUTION.md](BENCHMARK_CALLS_RESOLUTION.md)  
**Script:** `scripts/benchmark-calls-resolution.ts`

### Puerta de decisión

| Miss rate vs verdad manual | Acción |
| -------------------------- | ------ |
| **< 15%** | Mantener parser tree-sitter actual |
| **15–30%** | Monitorizar; heurísticas puntuales |
| **> 30%** | Planificar Camino C (LSP / tsserver) |

### Ejecución

1. Crear muestra local (50 sitios cross-file), p. ej. `scripts/benchmark-calls-resolution.sample.json`:

   ```json
   [
     {
       "callerFile": "src/utils/format.ts",
       "callerFn": "formatDate",
       "calleeName": "parseISO",
       "expectedCalleeFile": "src/utils/date.ts"
     }
   ]
   ```

2. Ejecutar:

   ```bash
   FALKORDB_HOST=localhost FALKORDB_PORT=6379 \
     npx tsx scripts/benchmark-calls-resolution.ts \
     --project-id <PROJECT_UUID> \
     --repo-id <REPO_UUID> \
     --sample scripts/benchmark-calls-resolution.sample.json
   ```

3. Registrar miss rate en la plantilla de resultados del doc de benchmark.

---

## Tabla de troubleshooting

| Síntoma | Causa probable | Acción |
| ------- | -------------- | ------ |
| MCP `query_graph`: falta `projectId` | `FALKOR_SHARD_BY_PROJECT=true` | Pasar UUID de repo/proyecto o `currentFilePath` |
| `Blocked write/destructive Cypher` | Query con MERGE/CREATE/… | Usar solo MATCH/RETURN |
| `detect_changes`: diff vacío | Sin cambios en el modo elegido | `git add` y repetir, o cambiar `mode` |
| `detect_changes`: error git en MCP | MCP sin acceso al repo | Pasar `diff` / `stagedDiff` en el body |
| POST detect-changes 400 | Falta campo `diff` | Generar `git diff` local y POSTear raw |
| Ollama connection refused | Servicio no levantado | `--profile embed-local` o Ollama en host :11434 |
| embed-index: dimensión incorrecta | `LLM_EMBEDDING_DIM` ≠ modelo | Alinear dim (768 Nomic) y re-embed |
| Export artifact falla clone | Credenciales Git | Configurar credencial en UI / env |
| Import `local_graph_not_empty` | Falkor ya indexado | Vaciar shard o `GRAPH_ARTIFACT_FORCE_IMPORT=1` |
| Import `integrity_failed` | Manifest SHA no coincide | Re-exportar artifact |
| Benchmark: 0 CALLS | Repo sin sync o sin edges cross-file | Full sync; ampliar muestra |
| Falkor `vecf32` unknown | Imagen Falkor antigua | Usar `falkordb/falkordb:v4.16.5` del compose |

---

## Checklist smoke (5 minutos)

- [ ] `docker compose -f docker-compose.yml -f docker-compose.dev.yml ps` — servicios healthy
- [ ] `curl -s http://localhost:3002/health` (o endpoint health ingest) — OK
- [ ] `curl -s http://localhost:3000/health` — API OK
- [ ] Al menos un repo en estado synced (`GET /repositories`)
- [ ] MCP responde: `tools/list` en `http://127.0.0.1:9888/mcp`
- [ ] `query_graph` devuelve filas con `projectId` válido
- [ ] `pnpm test:ingest` pasa (o specs Camino D citados arriba)

---

## Referencias de código

| Área | Ruta |
| ---- | ---- |
| Cypher guard | `packages/ariadne-common/src/cypher-guard.ts` |
| Tests cypher guard | `packages/ariadne-common/src/cypher-guard.spec.ts` |
| Diff / blast radius | `packages/ariadne-common/src/diff-impact.ts` |
| Tests diff-impact | `packages/ariadne-common/src/diff-impact.spec.ts` |
| MCP query_graph | `services/mcp-ariadne/src/index.ts` |
| MCP detect_changes | `services/mcp-ariadne/src/detect-changes-handler.ts` |
| Ingest detect-changes | `services/ingest/src/analysis/detect-changes.controller.ts` |
| Graph export | `services/ingest/src/artifact/graph-export.service.ts` |
| Graph import | `services/ingest/src/artifact/graph-import.service.ts` |
| Tests artifact | `services/ingest/src/artifact/graph-artifact.spec.ts` |
| Ollama provider | `services/ingest/src/embedding/providers/ollama.provider.ts` |
| Benchmark CALLS | `scripts/benchmark-calls-resolution.ts` |
| Plan Camino D | `docs/notebooklm/PLAN_CBM_PARITY_CAMINO_D.md` |
| Puertos dev | `docker-compose.dev.yml` |
| Spec MCP HTTP | `docs/notebooklm/MCP_HTTPS.md` |

---

## Documentos relacionados

- [TESTING.md](TESTING.md) — Vitest, Playwright, CI general
- [CONFIGURACION_Y_USO.md](../manual/CONFIGURACION_Y_USO.md) — variables y flujo de sync
- [mcp_server_specs.md](mcp_server_specs.md) — catálogo completo de herramientas MCP
