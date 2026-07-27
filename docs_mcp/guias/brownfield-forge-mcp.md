---
id: brownfield-forge-mcp
title: Brownfield The Forge vía MCP
category: Guías
last_updated: 2026-07-27
---

# Brownfield The Forge vía MCP

> **AI Context Brief:** The Forge y Cursor importan brownfield por MCP Ariadne: en proyectos **multi-root** (varios repos Git en un workspace) usa **`export_brownfield_project_parity_pack`** con el UUID del **proyecto** Ariadne; un solo repo usa **`export_brownfield_parity_pack`** con `repositoryId`.

## 1. Uso Básico (Quick Start)

```typescript
// 1) Descubrir IDs
const projects = await list_known_projects();
// projects[].id     → UUID proyecto Ariadne (workspace multi-root)
// projects[].roots[].id → UUID de cada repositorio Git indexado

// 2) The Forge LEGACY — proyecto OBP con front + back (2 repos)
await export_brownfield_project_parity_pack({
  projectId: "<uuid-proyecto-ariadne>", // NO roots[].id
  userDescription: "OBP brownfield baseline",
});

// 3) Solo MDD fusionado (sin parity pack completo)
await generate_merged_project_mdd({
  projectId: "<uuid-proyecto-ariadne>",
});

// 4) Un solo repo
await export_brownfield_parity_pack({
  repositoryId: "<roots[].id>",
});
```

## 2. API & Contrato de Tipos (Specs)

| Tool | Cuándo usarla | `projectId` | Salida clave |
| ---- | ------------- | ----------- | ------------ |
| `export_brownfield_project_parity_pack` | **Import inicial Forge multi-root** | UUID **proyecto** Ariadne (`list_known_projects[].id`) | `mergeMode: project_multi_root`, `mdd`, `mddSources[]`, `modificationPlanSeed`, `multi_root` |
| `generate_merged_project_mdd` | Solo documentación MDD fusionada | UUID **proyecto** Ariadne | `mdd` JSON + `mddSources[]` |
| `generate_legacy_documentation` | MDD de **un** repo (scope acotado) | Proyecto o `roots[].id` + `scope.repoIds` | `legacy_mdd_v1` envelope |
| `export_brownfield_parity_pack` | Parity pack **mono-repo** o legacy con `mergeProject: true` | Repo o proyecto según flags | Parity pack v1 |

### Parámetros comunes (merge proyecto)

| Parámetro | Tipo | Default | Descripción |
| --------- | ---- | ------- | ----------- |
| `projectId` | `string` | — | **Obligatorio.** UUID del proyecto Ariadne (campo `id` en `list_known_projects`, no `roots[].id`). |
| `userDescription` | `string` | baseline | Seed para `modificationPlanSeed`. |
| `preferSnapshots` | `boolean` | `true` | Usar MDD persistido post-sync por repo. |
| `live` | `boolean` | `false` | Si `true`, rebuild live por repo (ignora snapshots). |

### Campo `mdd.multi_root` (semántica)

| Campo | Significado |
| ----- | ----------- |
| `is_multi_root` | `true` si el workspace tiene ≥2 repos Git en Ariadne. |
| `repositories[]` | Slug (`projectKey/repoSlug`), rol (`frontend`/`backend`), sync. |
| `mdd_scope_repo_ids` | Repos incluidos en este MDD (todos en merge proyecto). |
| `cross_repo_links` | Enlaces Falkor front↔back (`CALLS_STRAPI_ROUTE`, etc.). |
| `notes` | **Multi-repo Git ≠ deploy independiente** — revisar Strapi/Docker. |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** Para Forge LEGACY con front+back indexados juntos, **no** uses solo `generate_legacy_documentation` sobre el repo backend — falta evidencia del front. Usa **`export_brownfield_project_parity_pack`**.
- **Regla 2:** `list_known_projects().id` ≠ `roots[].id`. El merge proyecto requiere el **`id` del proyecto**.
- **Regla 3:** Ejecuta `get_sync_status` antes del import; resync si `stale: true`.
- **Regla 4:** Tras cambios de código, regenera con `live: true` o resync + snapshots post-sync.
- **Regla 5:** The Forge consume MCP Streamable HTTP (`tools/call`); mismo contrato que Cursor.

## 4. Endpoints ingest (referencia)

| MCP tool | Ingest |
| -------- | ------ |
| `export_brownfield_project_parity_pack` | `POST /internal/projects/:projectId/brownfield-parity-pack` |
| `generate_merged_project_mdd` | `POST /internal/projects/:projectId/mdd-evidence-merged` |
| `export_brownfield_parity_pack` (repo) | `POST /internal/repositories/:repoId/brownfield-parity-pack` |

Contrato JSON: `docs/contracts/brownfield-parity-pack-v1.md`.
