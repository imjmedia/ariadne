---
id: mcp-ariadne-overview
title: MCP AriadneSpecs (grafo de código)
category: Arquitectura
last_updated: 2026-06-29
---

# MCP AriadneSpecs (`services/mcp-ariadne`)

> **AI Context Brief:** Servidor MCP principal de Ariadne que expone el grafo FalkorDB indexado (~30 tools: búsqueda semántica, impacto legacy, validación pre-edición); úsalo para entender código de repos indexados, no para leer docs estáticas del repo Ariadne.

## 1. Uso Básico (Quick Start)

```typescript
// 1) Descubrir proyectos indexados (siempre primero):
//    tool list_known_projects()  ->  [{ id, name, roots: [{ id, name, branch? }] }]

// 2) En multi-root, pasa roots[].id como projectId (no el UUID del proyecto).

// 3) Flujo típico antes de editar:
//    semantic_search("…")  ->  get_file_context(path)  ->  validate_before_edit("ComponentName")

// Transporte operativo: Streamable HTTP en /mcp (puerto 8080).
// Bearer: Secret MCP ari_* del usuario (validado vía ingest), reenviado al Nest API.
```

## 2. API & Contrato de Tipos (Specs)

| Tool (selección)              | Cuándo usarla                                              |
| ----------------------------- | ---------------------------------------------------------- |
| `list_known_projects`         | Inicio de sesión; mapea IDs a nombres/repos.               |
| `semantic_search`             | Encontrar código por intención (requiere `projectId` con sharding). |
| `get_file_content` / `get_file_context` | Leer un archivo cuando ya conoces la ruta.      |
| `validate_before_edit`        | **Obligatorio** antes de tocar un componente/función.      |
| `get_component_graph`         | Árbol de dependencias (RENDERS, IMPORTS, USES_HOOK).       |
| `get_legacy_impact`           | Quién depende de un nodo (blast radius inverso).          |
| `get_modification_plan`       | Plan de archivos a modificar + preguntas de negocio.       |
| `analyze_local_changes`       | Pre-commit: diff vs grafo.                                 |

**Capacidades MCP:** solo `tools` (no expone `resources` MCP). Para documentación estática del repo Ariadne usa `services/mcp-docs`.

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** `projectId` puede ser ID de **proyecto** o de **repo** (`roots[].id`); el MCP resuelve automáticamente según el endpoint.
- **Regla 2:** Con `FALKOR_SHARD_BY_PROJECT=true`, `semantic_search` exige `projectId` explícito.
- **Regla 3:** Preferir herramientas baratas (`get_definitions`, `get_references`) cuando ya conoces el símbolo; reservar `ask_codebase` para preguntas abiertas.
- **Regla 4:** Verificar frescura con `get_sync_status` si los resultados parecen desactualizados.
