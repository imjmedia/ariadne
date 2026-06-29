# Plan: CBM parity — Camino D

Incremental path to **Codebase Map (CBM) parity** without LSP-first indexing. Phases 1–2 landed on `feat/cbm-parity-phase-1-2`; phases 3–4 below.

## Phase 1 — MCP `query_graph` + Cypher guard

- Read-only Cypher from MCP with `projectId` scoping (`packages/ariadne-common/src/cypher-guard.ts`).
- MCP tool `query_graph`.

## Phase 2 — `detect_changes` blast radius

- `packages/ariadne-common/src/diff-impact.ts`
- Ingest `POST /repositories/:id/detect-changes`
- MCP `detect_changes` with staged/unstaged/all modes.

## Phase 3 — Graph artifact for team bootstrap ✅

Optional compressed subgraph in the cloned repo (not committed by default).

### Export

- **Service:** `services/ingest/src/artifact/graph-export.service.ts`
- Subgraph for `(projectId, repoId)` → JSONL (nodes + edges) → **zstd**
- **Paths in clone:** `.ariadne/graph-<repoId>.jsonl.zst`, `.ariadne/manifest.json`
- **Manifest:** SHA-256, node/edge counts, `exportedAt`, `commitSha`, compression tier
- **Tiers:** `fast` (zstd-3) for watcher/incremental; `best` (zstd-9) for explicit full sync / post-sync when `GRAPH_ARTIFACT_EXPORT_ON_SYNC=1`
- **API:** `POST /repositories/:id/export-graph-artifact` body `{ projectId?, tier?: 'fast'|'best' }`

### Import

- **Service:** `services/ingest/src/artifact/graph-import.service.ts`
- On sync bootstrap: if artifact exists in clone and local Falkor slice empty (or `GRAPH_ARTIFACT_FORCE_IMPORT=1`), import after SHA-256 check
- If manifest `commitSha` matches `HEAD`, skip graph write phase (fast bootstrap)
- **`.gitattributes`:** `*.zst merge=ours` appended on first export

### Module

- `services/ingest/src/artifact/artifact.module.ts` — wired in `SyncModule`
- Tests: `services/ingest/src/artifact/graph-artifact.spec.ts`

### Env

| Variable | Purpose |
| -------- | ------- |
| `GRAPH_ARTIFACT_EXPORT_ON_SYNC` | `1`/`true`: write artifact after successful full sync (into clone workDir) |
| `GRAPH_ARTIFACT_FORCE_IMPORT` | Re-import even if Falkor already has nodes |

## Phase 4 — CALLS resolution benchmark (spike) ✅

- **Doc:** `docs/notebooklm/BENCHMARK_CALLS_RESOLUTION.md`
- **Script:** `scripts/benchmark-calls-resolution.ts` (+ sample JSON)
- Decision gate: miss rate &lt; 15% → no LSP; &gt; 30% → Camino C hybrid

## Usage (Phase 3)

```bash
# Export after index (clones repo, writes .ariadne/ in temp clone — copy files manually if committing)
curl -X POST http://localhost:3002/repositories/<repoId>/export-graph-artifact \
  -H 'Content-Type: application/json' \
  -d '{"tier":"best"}'

# Team member: commit .ariadne/ optionally (add to .gitignore if not sharing)
# Next sync on empty Falkor imports artifact when commit matches manifest
```

See also `docs/manual/CONFIGURACION_Y_USO.md` § Graph artifact.
