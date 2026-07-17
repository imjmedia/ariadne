## Benchmark CALLS (repos críticos)

Tras full sync + resync:

```bash
npm run benchmark:calls -- --repoId=<uuid>
```

Si miss rate >30%, evaluar Camino C (LSP híbrido). Ver `docs/notebooklm/BENCHMARK_CALLS_RESOLUTION.md`.

## Indexación de tests por repo

UI **Editar repositorio** → «Indexar tests» o env global `INDEX_TESTS=1`. Requiere **resync** para aplicar.
