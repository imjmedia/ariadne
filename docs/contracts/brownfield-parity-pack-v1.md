# Brownfield Parity Pack — Contract v1

JSON bundle produced by **`export_brownfield_parity_pack`** (MCP + `POST /internal/repositories/:id/brownfield-parity-pack`).

## Fields

| Field | Description |
|-------|-------------|
| `schemaVersion` | `"1.0"` |
| `source` | `"ariadne"` |
| `generatedAt` | ISO timestamp |
| `repositoryId` | UUID repo |
| `projectId` | Falkor project UUID |
| `mdd` | MDD 7§ JSON (same as `generate_legacy_documentation`) |
| `navigationMapHint` | Instruction to run `generate_navigation_map` |
| `scaffoldPreview` | `{ fileCount, paths[] }` |
| `modificationPlanSeed` | JSON string with `filesToModify` sample |

## The Forge import

Map sections to greenfield deliverables: SPEC ← `mdd.summary`, API ← `mdd.api_contracts`, entities ← `mdd.entities`, tasks ← `modificationPlanSeed` + Forge LLM.
