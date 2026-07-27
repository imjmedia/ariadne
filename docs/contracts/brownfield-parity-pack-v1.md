# Brownfield Parity Pack — Contract v1

JSON bundle produced by **`export_brownfield_parity_pack`** (MCP + `POST /internal/repositories/:id/brownfield-parity-pack`).

## Fields

| Field | Description |
|-------|-------------|
| `schemaVersion` | `"1.0"` |
| `source` | `"ariadne"` |
| `generatedAt` | ISO timestamp |
| `repositoryId` | UUID repo ancla (single-repo o primero del merge) |
| `repositoryIds` | Todos los repos cuando `mergeMode=project_multi_root` |
| `mergeMode` | `single_repo` \| `project_multi_root` |
| `mddSources` | Origen por repo (`fromSnapshot`, `snapshotId`, `slug`) |
| `mdd` | MDD JSON (`summary`, secciones 7§, opcional `multi_root`) |
| `projectId` | Falkor project UUID |
| `navigationMapHint` | Instruction to run `generate_navigation_map` |
| `scaffoldPreview` | `{ fileCount, paths[] }` |
| `modificationPlanSeed` | JSON string with `filesToModify` sample |

## Project merge (multi-root)

`POST /internal/projects/:projectId/brownfield-parity-pack` or MCP:

```json
{ "projectId": "<uuid-proyecto-ariadne>", "mergeProject": true }
```

Optional: `preferSnapshots: false` or `live: true` to rebuild MDD live per repo instead of using post-sync snapshots.

## The Forge import

Map sections to greenfield deliverables: SPEC ← `mdd.summary` + `mdd.multi_root`, API ← `mdd.api_contracts`, entities ← `mdd.entities`, tasks ← `modificationPlanSeed` + Forge LLM.
