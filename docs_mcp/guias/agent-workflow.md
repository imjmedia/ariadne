---
id: agent-workflow
title: Flujo de agente con Ariadne MCP
category: Guías
last_updated: 2026-07-17
---

# Flujo de agente con Ariadne MCP (grafo)

> **AI Context Brief:** Workflow mínimo y obligatorio para agentes que editan repos indexados en Ariadne: descubrir proyecto, frescura, dos gates, validar impacto, editar, revisar pre-commit.

## 1. Uso Básico (Quick Start)

```typescript
await list_known_projects();
await get_sync_status({ projectId: "<repo-id>" });
await semantic_search({ query: "auth middleware", projectId: "<repo-id>" });
await get_file_context({ path: "src/auth/guard.ts", projectId: "<repo-id>" });
await validate_before_edit({ nodeName: "AuthGuard", projectId: "<repo-id>" });
// … editar código …
await detect_changes({ mode: "staged" });
```

## 2. API & Contrato de Tipos (Specs)

| Fase        | Tool(s)                                              | Obligatorio |
| ----------- | ---------------------------------------------------- | ----------- |
| Inicio      | `list_known_projects`, `get_sync_status`             | Sí          |
| Gate 1      | `get_modification_plan`                              | Refactors multi-archivo |
| Gate 2      | `validate_change_plan`                               | **Sí** antes de editar si Gate 1 |
| Descubrir   | `semantic_search`, `get_definitions`                 | Según caso  |
| Leer        | `get_file_content`, `get_file_context`               | Si aplica   |
| Pre-edición | `validate_before_edit`, `get_references`             | **Sí**      |
| Brownfield  | `generate_legacy_documentation`, `export_brownfield_parity_pack` | Doc The Forge |
| Scaffold    | `generate_scaffold_from_mdd`                         | Esqueleto desde MDD |
| Pre-commit  | `detect_changes`, `check_breaking_changes`           | Recomendado |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** Si `get_sync_status` → `stale: true`, resync antes de Gate 2.
- **Regla 2:** No editar si `validate_change_plan` → `BLOCKED`.
- **Regla 3:** `validate_before_edit` antes de tocar cualquier símbolo público.
- **Regla 4:** Herramientas baratas primero; no uses `ask_codebase` si conoces path/símbolo.
- **Regla 5:** Para docs del repo Ariadne (no código indexado), usa `mcp-docs`.
