---
id: agent-workflow
title: Flujo de agente con Ariadne MCP
category: Guías
last_updated: 2026-06-29
---

# Flujo de agente con Ariadne MCP (grafo)

> **AI Context Brief:** Workflow mínimo y obligatorio para agentes que editan repos indexados en Ariadne: descubrir proyecto, buscar, validar impacto, editar, revisar pre-commit.

## 1. Uso Básico (Quick Start)

```typescript
// Sesión (grafo de código — mcp-ariadne):
await list_known_projects();
// Multi-root: usa roots[].id como projectId

await semantic_search({ query: "auth middleware", projectId: "<repo-id>" });
await get_file_context({ path: "src/auth/guard.ts", projectId: "<repo-id>" });
await validate_before_edit({ nodeName: "AuthGuard", projectId: "<repo-id>" });
// … editar código …
await analyze_local_changes();
```

## 2. API & Contrato de Tipos (Specs)

| Fase        | Tool(s)                                              | Obligatorio |
| ----------- | ---------------------------------------------------- | ----------- |
| Inicio      | `list_known_projects`                                | Sí          |
| Descubrir   | `semantic_search`, `get_definitions`, `ask_codebase` | Según caso  |
| Leer        | `get_file_content`, `get_file_context`               | Si aplica   |
| Pre-edición | `validate_before_edit`, `get_references`             | **Sí**      |
| Planificar  | `get_modification_plan`, `get_affected_scopes`       | Refactors   |
| Pre-commit  | `analyze_local_changes`, `check_breaking_changes`    | Recomendado |
| Frescura    | `get_sync_status`                                    | Si dudas    |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** `validate_before_edit` antes de tocar cualquier componente/función pública — sin excepciones.
- **Regla 2:** Resuelve y cachea `projectId` temprano; casi todas las tools lo mejoran.
- **Regla 3:** Herramientas baratas primero: si conoces path/símbolo, no uses `ask_codebase`.
- **Regla 4:** `find_similar_implementations` antes de escribir código nuevo duplicado.
- **Regla 5:** Para docs del propio repo Ariadne (no código indexado), usa el servidor `mcp-docs` (`docs://manifest`).
