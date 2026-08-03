# Sync (full / resync)

Cola BullMQ (`sync.processor.ts`, `concurrency: 1` por worker) → `SyncService.runFullSync()`.

## Fases (`payload.phase`)

| Phase | UI (syncPipeline.ts) |
|-------|----------------------|
| `queued` | Encolado |
| `mapping` / `mapping_done` | Descubrimiento de rutas |
| `indexing` | Descarga + parseo Tree-sitter |
| `writing_graph` | Escritura Falkor (Cypher) |
| `embeddings` | `EmbedIndexService.runEmbedIndex()` |

## Rendimiento

| Variable | Default | Efecto |
|----------|---------|--------|
| `SYNC_PARSE_CONCURRENCY` | 4 (máx. 32) | Paraleliza fetch+parse en fase `indexing`. `1` = secuencial. |
| `EMBED_INDEX_CONCURRENCY` | 5 | Batches simultáneos al proveedor de embeddings (fase final). |
| `FALKORDB_BATCH_SIZE` | 500 | Chunking de statements Cypher (ejecución aún secuencial). |

Tras `resolveCrossFileCalls()` la escritura al grafo sigue secuencial por archivo (PR futuro: semáforo Falkor).
