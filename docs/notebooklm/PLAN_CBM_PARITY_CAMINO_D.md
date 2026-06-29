# Plan: paridad estructural con codebase-memory-mcp (Camino D)

**Estado:** Propuesta — sin implementación  
**Rama:** `plan/cbm-parity-camino-d`  
**Fecha:** 2026-06-29  
**Contexto:** Análisis comparativo [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) (CBM) vs Ariadne. Decisión: **no** sustituir Ariadne ni integrar el binario CBM (Camino C); **sí** cerrar brechas de motor local/MCP con mejoras acotadas.

---

## 1. Decisión estratégica

| Opción | Veredicto |
|--------|-----------|
| Abandonar Ariadne por CBM | ❌ Pierde sync remoto, gobierno, UI, SDD, multi-proyecto |
| Fork / absorber CBM entero | ❌ Arquitecturas incompatibles (C monolito vs Nest distribuido) |
| **Camino D — mejoras puntuales** | ✅ Recomendado |
| Camino C — adaptador CBM→Falkor | ⏸ Solo si contrato exige 50+ lenguajes |

**Principio:** Ariadne conserva plataforma (ingest remoto, Falkor, MCP HTTP, dominios, shadow SDD). Se roban de CBM las piezas de **consulta estructural rápida**, **diff→impacto** y **embeddings offline**, sin reescribir el parser.

---

## 2. Brechas a cerrar (priorizadas)

| # | Brecha vs CBM | Estado Ariadne hoy | Objetivo |
|---|---------------|-------------------|----------|
| 1 | `query_graph` Cypher directo | Solo vía `ask_codebase` (LLM) | Tool MCP read-only, sub-ms en queries simples |
| 2 | `detect_changes` (working tree + staged) | `analyze_local_changes` solo staged | Modos staged/unstaged/all + endpoint ingest |
| 3 | Embeddings bundled / offline | OpenRouter obligatorio en prod | Provider Ollama/nomic local en dev |
| 4 | Artifact equipo (bootstrap sin reindex) | Solo sync centralizado | `.ariadne/graph-*.db.zst` opcional en repo |
| 5 | Hybrid LSP (CALLS precisos) | Tree-sitter + resolución textual | Evaluar en Fase 4; no bloquea Fases 1–3 |

---

## 3. Fases de implementación

### Fase 1 — `query_graph` + endurecer diff (2 semanas)

**Objetivo:** Paridad MCP estructural sin LLM para queries recurrentes (dead code, CALLS, IMPORTS).

#### 1.1 `query_graph` (MCP)

| Tarea | Ubicación | Detalle |
|-------|-----------|---------|
| Guard Cypher read-only | `packages/ariadne-common/src/cypher-guard.ts` | Rechazar `MERGE`, `CREATE`, `DELETE`, `SET`, `DROP`, `CALL {` |
| Inyección `projectId` | mismo módulo | Si query no filtra por proyecto, añadir `WHERE n.projectId = $pid` |
| Tool MCP | `services/mcp-ariadne/src/index.ts` | `query_graph({ query, projectId, limit? })` |
| Tests | `packages/ariadne-common/src/cypher-guard.spec.ts` | Queries válidas + bloqueadas |
| Docs | `docs/notebooklm/mcp_server_specs.md`, `AGENTS.md` | Contrato tool + ejemplos |

**Criterios de aceptación:**

- [ ] `MATCH (f:Function) WHERE NOT EXISTS { (f)<-[:CALLS]-() } RETURN f.name LIMIT 10` funciona con `projectId`
- [ ] `MERGE (n:File)` devuelve error claro, no ejecuta
- [ ] Con sharding activo, `projectId` obligatorio (igual que `semantic_search`)
- [ ] Latencia p95 &lt; 200 ms en grafo &lt; 50k nodos (mismo shard)

**Queries de referencia (paridad CBM):**

```cypher
-- inbound calls
MATCH (caller)-[:CALLS]->(callee:Function {name: $name, projectId: $pid})
RETURN caller.name, caller.path LIMIT 20

-- archivos que importan X
MATCH (a:File)-[:IMPORTS]->(b:File {path: $path, projectId: $pid})
RETURN a.path
```

#### 1.2 `detect_changes` (evolución de `analyze_local_changes`)

| Tarea | Ubicación | Detalle |
|-------|-----------|---------|
| Renombrar o alias | `services/mcp-ariadne/src/index.ts` | Mantener `analyze_local_changes` como alias deprecated |
| Parámetro `mode` | MCP + helper git | `staged` (default), `unstaged`, `all` |
| Endpoint remoto | `services/ingest/src/analysis/detect-changes.controller.ts` | `POST /repositories/:id/detect-changes` body `{ mode, baseRef? }` |
| Blast radius | Reutilizar Cypher de `get_legacy_impact` | `CALLS`, `RENDERS`, `IMPORTS` multi-shard vía API Nest |
| Respuesta JSON | schema estable | `changedFiles`, `affectedSymbols[]`, `summary: { high, medium, low }` |

**Criterios de aceptación:**

- [ ] `mode: unstaged` usa `git diff` en `workspaceRoot`
- [ ] MCP remoto (sin FS) acepta `stagedDiff` o llama ingest con token repo
- [ ] Tabla de riesgo ALTO/MEDIO/BAJO alineada con `analyze_local_changes` actual
- [ ] Tests unitarios: parser diff + clasificación riesgo mock grafo

**Dependencias:** ninguna nueva infra.

---

### Fase 2 — Embeddings locales Ollama (1 semana)

**Objetivo:** Dev sin API key; reducir coste/latencia embed post-sync.

| Tarea | Ubicación | Detalle |
|-------|-----------|---------|
| Provider Ollama | `services/ingest/src/embedding/providers/ollama.provider.ts` | `POST /api/embeddings` |
| Registro provider | `services/ingest/src/embedding/providers/index.ts` | `EMBEDDING_PROVIDER=ollama` |
| Dimensión vector | `embedding-space` + Falkor | `LLM_EMBEDDING_DIM=768` para `nomic-embed-text` |
| Compose dev opcional | `docker-compose.dev.yml` | Servicio `ollama` + profile `embed-local` |
| Docs | `services/ingest/src/embedding/providers/README.md` | Matriz provider × dimensión |

**Criterios de aceptación:**

- [ ] `SYNC_SKIP_EMBED_INDEX` no requerido; embed post-sync con Ollama local
- [ ] `semantic_search` devuelve resultados con `EMBEDDING_PROVIDER=ollama`
- [ ] Falla clara si Ollama no alcanzable (no silent fallback a OpenRouter sin aviso)

**Riesgo:** dimensión 768 vs 1536 — requiere espacio vectorial dedicado o re-embed al cambiar provider.

---

### Fase 3 — Artifact de grafo para equipo (3 semanas)

**Objetivo:** Paridad espiritual con `.codebase-memory/graph.db.zst` de CBM.

| Tarea | Ubicación | Detalle |
|-------|-----------|---------|
| Formato export | `services/ingest/src/artifact/graph-export.service.ts` | JSONL nodos/aristas por `projectId`+`repoId` → zstd |
| Import bootstrap | `services/ingest/src/artifact/graph-import.service.ts` | Si existe `.ariadne/graph-<repoId>.jsonl.zst`, import + incremental |
| Hook post-sync | `services/ingest/src/sync/sync.service.ts` | Tier fast (zstd-3) en watcher; tier best (zstd-9) en full sync explícito |
| Git attributes | generado en primer export | `.gitattributes` `merge=ours` para `*.zst` |
| API | `POST /repositories/:id/export-graph-artifact` | Solo admin / token con scope |

**Criterios de aceptación:**

- [ ] Clone + artifact → incremental sync &lt; 30% tiempo full sync en repo mediano
- [ ] Integridad: checksum SHA-256 en manifest sidecar `.ariadne/manifest.json`
- [ ] Documentado en `docs/manual/CONFIGURACION_Y_USO.md` como **opcional** (no commitear por defecto)

**Riesgo:** Falkor no es SQLite — formato propio; no importar dumps CBM directamente (eso sería Camino C).

---

### Fase 4 — Evaluación Hybrid LSP (spike, no compromiso)

**Objetivo:** Medir si tree-sitter actual pierde CALLS críticos vs CBM.

| Tarea | Detalle |
|-------|---------|
| Benchmark | 3 repos internos: Nest monorepo, React app, Python service |
| Métrica | % CALLS resueltos cross-file (muestreo manual 50 call sites) |
| Spike opcional | Sidecar `typescript-language-server` o invocar CBM CLI solo para diff de CALLS |
| Decisión gate | Si gap &lt; 15%, no invertir; si &gt; 30%, planificar Camino C hybrid |

**Entregable:** `docs/notebooklm/BENCHMARK_CALLS_RESOLUTION.md` — sin código de producción obligatorio.

---

## 4. Fuera de alcance (este plan)

- Integración binario CBM en ingest (Camino C)
- UI 3D tipo CBM localhost:9749 (Ariadne ya tiene graph explorer)
- 158 lenguajes tree-sitter
- Reemplazo FalkorDB por SQLite
- ADR tool (`manage_adr`) — evaluar después de Fase 1 si hay demanda

---

## 5. Orden de ramas / PRs sugerido

```
master
 ├── fix/dev-compose-ports-llm-reasoning     (WIP local — ya pusheada)
 ├── feat/query-graph-cypher-guard           (Fase 1.1)
 ├── feat/detect-changes-mcp-ingest          (Fase 1.2)
 ├── feat/embedding-ollama-provider          (Fase 2)
 ├── feat/graph-artifact-export-import       (Fase 3)
 └── spike/calls-resolution-benchmark        (Fase 4)
```

Cada PR: tests + actualización `mcp_server_specs.md` + entrada en `CHANGELOG.md`.

---

## 6. Métricas de éxito (post Fase 1–2)

| Métrica | Baseline actual | Target |
|---------|-----------------|--------|
| Tokens por dead-code query | ~2k–8k (`ask_codebase`) | &lt; 500 (`query_graph`) |
| Latencia dead-code | 3–15 s (LLM) | &lt; 500 ms |
| Pre-commit diff sin FS local | Solo `stagedDiff` manual | `detect_changes` vía ingest |
| Coste embed dev/mes | OpenRouter $ | $0 con Ollama local |

---

## 7. Referencias internas

- `services/mcp-ariadne/src/index.ts` — `analyze_local_changes` (~L3849)
- `docs/notebooklm/mcp_server_specs.md` — contrato MCP
- `docs/notebooklm/architecture.md` — límite 100k nodos Falkor
- `docs/notebooklm/Mejoras_Ariadne_Marzo.md` — plan previo (complementario, no sustituto)

---

## 8. Próximo paso

**No implementar en esta rama.** Abrir PR de este documento; tras merge, crear `feat/query-graph-cypher-guard` desde `master` y ejecutar Fase 1.1.
