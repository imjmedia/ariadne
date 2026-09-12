---
id: c4-architecture-mcp
title: Diagramas C4 vía MCP
category: Guías
last_updated: 2026-09-11
---

# Diagramas C4 vía MCP

> **AI Context Brief:** Tres tools MCP (`get_c4_model`, `generate_c4_diagram`, `diff_c4_model`) leen o regeneran modelos C4 persistidos en ingest (JSON + HTML Archify); úsalas para arquitectura de alto nivel, no para explorar código línea a línea.

## 1. Uso Básico (Quick Start)

```typescript
await list_known_projects();
await get_sync_status({ projectId: "<uuid-proyecto-ariadne>" });

// JSON del último snapshot (container por defecto)
await get_c4_model({
  projectId: "<uuid-proyecto-ariadne>",
  level: "container",
});

// Regenerar + URLs HTML Archify
await generate_c4_diagram({
  projectId: "<uuid-proyecto-ariadne>",
  levels: ["context", "container"],
  useLlm: true, // solo afecta context
});

// Diff entre dos snapshots (ids de listSnapshots vía ingest o UI)
await diff_c4_model({
  projectId: "<uuid-proyecto-ariadne>",
  fromSnapshotId: "<uuid-snapshot-antiguo>",
  toSnapshotId: "<uuid-snapshot-reciente>",
});
```

## 2. API & Contrato de Tipos (Specs)

| Tool | Cuándo usarla | Salida clave |
| ---- | ------------- | ------------ |
| `get_c4_model` | Leer `C4Model` JSON sin abrir la UI | `{ model }` desde ingest `GET /projects/:id/c4?level=` |
| `generate_c4_diagram` | Forzar regeneración + enlaces HTML | `{ generated, htmlUrls[] }` con `htmlUrl` absoluta al ingest |
| `diff_c4_model` | Comparar dos versiones del modelo | JSON diff + `archifyCompareHtml` si Archify disponible |

### Niveles C4

| `level` | Fuente | Notas |
| ------- | ------ | ----- |
| `context` | Dominios + actores | `useLlm: true` añade narrativa LLM (requiere API key en Ajustes → IA) |
| `container` | `docker-compose` / infra indexada | Nivel por defecto; auto tras full sync si está activo |
| `component` | Falkor (módulos Nest/React) | `containerKey` opcional (ej. `ingest`, `frontend`) |

**Secuencias API** (flujo Route → endpoint): no hay tool MCP dedicada; usar ingest `POST /projects/:id/c4/sequence/generate` o la pestaña **Secuencia** en Arquitectura.

### Parámetros `get_c4_model`

| Parámetro | Tipo | Descripción |
| --------- | ---- | ----------- |
| `projectId` | `string` | UUID del **proyecto** Ariadne (`list_known_projects[].id`) |
| `level` | `context` \| `container` \| `component` | Default `container` |
| `regenerate` | `boolean` | Si `true`, `POST /c4/generate` antes de leer |
| `useLlm` | `boolean` | Solo `context` |
| `containerKey` | `string` | Solo `component` |

### Parámetros `generate_c4_diagram`

| Parámetro | Tipo | Descripción |
| --------- | ---- | ----------- |
| `projectId` | `string` | Obligatorio |
| `level` | `string` | Un solo nivel |
| `levels` | `string[]` | Varios niveles en una llamada |
| `useLlm` | `boolean` | Solo context |
| `containerKey` | `string` | Solo component |

### Parámetros `diff_c4_model`

| Parámetro | Tipo | Descripción |
| --------- | ---- | ----------- |
| `projectId` | `string` | Obligatorio |
| `fromSnapshotId` | `string` | Snapshot más antiguo |
| `toSnapshotId` | `string` | Snapshot más reciente |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** C4 requiere **C4 habilitado** en Ajustes → Sistema y proyecto con sync reciente; si `get_sync_status` → `stale: true`, resync antes de confiar en component/context.
- **Regla 2:** `projectId` = UUID del **proyecto**, no `roots[].id` (salvo que ingest resuelva repo; preferir `id` del proyecto).
- **Regla 3:** HTML Archify depende del binario en la imagen ingest (`/opt/archify`) o ruta en Ajustes → Sistema; sin Archify obtienes JSON pero `htmlUrl` puede fallar al abrir.
- **Regla 4:** Para detalle de código (props, call graph), usa `get_component_graph` / `get_file_context` — C4 es vista arquitectónica, no sustituto del grafo fino.
- **Regla 5:** Brownfield parity pack incluye `c4ContainerHtmlUrl`, `c4ContextHtmlUrl`, `c4ModelJson` cuando hay snapshots — ver `docs://guias/brownfield-forge-mcp`.

## 4. Endpoints ingest (referencia)

| MCP tool | Ingest |
| -------- | ------ |
| `get_c4_model` | `GET /projects/:id/c4?level=` (+ opcional `POST …/generate`) |
| `generate_c4_diagram` | `POST /projects/:id/c4/generate` |
| `diff_c4_model` | `GET /projects/:id/c4/diff?from=&to=` |

Plan funcional: `docs/notebooklm/PLAN_C4_ARCHIFY.md`. Configuración humana: `docs/manual/CONFIGURACION_Y_USO.md` (sección C4 / Diagramas).
