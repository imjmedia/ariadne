# Benchmark: CALLS resolution (Camino D — Phase 4)

Spike document for measuring how well Ariadne’s static parser resolves cross-file `CALLS` edges compared to a grep/heuristic baseline. Used as a **decision gate** before investing in LSP-based resolution (Camino C hybrid).

## Decision gate

| Gap (miss rate vs manual truth) | Action |
| ------------------------------- | ------ |
| **< 15%** | No LSP investment; keep tree-sitter + export map resolution |
| **15–30%** | Monitor; optional targeted heuristics |
| **> 30%** | Plan **Camino C hybrid** (LSP or tsserver for call graph enrichment) |

*Gap* = `(manual_calls − falkor_calls_matched) / manual_calls` on the sample set (see below).

## Methodology

1. **Sample:** Pick **50 cross-file call sites** from an indexed internal repo (mix of TS/JS: utils, services, React hooks, barrel re-exports).
2. **Manual truth:** For each site, record `(callerFile, callerFn, calleeName, expectedCalleeFile)` — verified by opening both files.
3. **Falkor ground truth:** Query ingest graph:
   ```cypher
   MATCH (caller:Function)-[:CALLS]->(callee:Function)
   WHERE caller.projectId = $projectId AND caller.repoId = $repoId
     AND caller.path = $callerFile AND caller.name = $callerFn
   RETURN callee.path AS path, callee.name AS name
   ```
4. **Heuristic baseline:** Same 50 sites — grep/import graph: resolve callee name in caller file’s import map + same-basename file search (see script).
5. **Score:** For each site, mark **hit** if Falkor (or heuristic) resolves to the same `calleeFile` as manual truth (name match optional tie-break).
6. **Report:** `missRate`, `precision`, breakdown by pattern (barrel import, dynamic import, re-export, monorepo path alias).

## How to run (internal repos)

### Prerequisites

- Ingest running with FalkorDB; target repo **fully synced**.
- `projectId` and `repoId` (repository UUID) from UI or `GET /repositories`.

### Optional script

```bash
# From repo root — compares Falkor CALLS vs heuristic for entries in a JSON sample file
FALKORDB_HOST=localhost FALKORDB_PORT=6379 \
  npx tsx scripts/benchmark-calls-resolution.ts \
  --project-id <uuid> \
  --repo-id <uuid> \
  --sample scripts/benchmark-calls-resolution.sample.json
```

Create `scripts/benchmark-calls-resolution.sample.json`:

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

Add **50 rows** per repo under evaluation. Commit the sample file only if it contains no proprietary paths (otherwise keep local).

### Environment

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `FALKORDB_HOST` | localhost | Falkor host |
| `FALKORDB_PORT` | 6379 | Falkor port |
| `FALKOR_SHARD_BY_PROJECT` | — | Must match ingest indexing |

## Results template

Fill after running against a real repo (placeholder structure):

| Metric | Falkor | Heuristic |
| ------ | ------ | --------- |
| Sites sampled | 50 | 50 |
| Hits | _TBD_ | _TBD_ |
| Miss rate | _TBD_% | _TBD_% |
| Barrel-import misses | _TBD_ | _TBD_ |
| Alias (`@/`) misses | _TBD_ | _TBD_ |

**Decision (placeholder):** _Run script on `ariadne` monorepo ingest + one customer repo, then record miss rate here._

## Limitations

- Sample is manual — bias toward “interesting” failures.
- Heuristic baseline is intentionally simple (not TypeScript compiler).
- Falkor edges reflect **ingest parser** at sync time; shadow/MCP paths use the same graph.
- Does not measure **intra-file** calls or indirect calls through interfaces.

## References

- Ingest resolution: `services/ingest/src/pipeline/producer.ts`, `packages/ariadne-common/src/graph-utils.ts` (`resolveCrossFileCalls`)
- Plan: `docs/notebooklm/PLAN_CBM_PARITY_CAMINO_D.md` (Phases 1–4)
