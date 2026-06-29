---
id: graph-tools-catalog
title: Catálogo de tools del grafo (MCP)
category: Guías
last_updated: 2026-06-29
---

# Catálogo de tools del grafo (mcp-ariadne)

> **AI Context Brief:** Referencia de cuándo usar cada herramienta del MCP de grafo de Ariadne y cómo evitar la cara `ask_codebase`; léelo para elegir la tool más barata que responda la pregunta.

## 1. Uso Básico (Quick Start)

```typescript
// Regla de oro de costo: usa la tool más específica que responda.
// "abrir un archivo que conozco"      -> get_file_content
// "origen/firma de un símbolo"        -> get_definitions / get_implementation_details
// "quién usa X"                       -> get_references
// "grafo/impacto de un componente"    -> get_component_graph / get_legacy_impact
// "dónde se menciona X (término)"     -> semantic_search
// "qué archivos tocar para feature Y" -> get_modification_plan
// pregunta exploratoria multi-fuente  -> ask_codebase (la más cara)
```

## 2. API & Contrato de Tipos (Specs)

| Objetivo                                          | Tool preferida                                  |
| ------------------------------------------------- | ----------------------------------------------- |
| Leer archivo de path conocido                     | `get_file_content`                              |
| Origen / firma de símbolo                         | `get_definitions`, `get_implementation_details` |
| Usos de un símbolo (imports, call sites)          | `get_references`                                |
| Props/tipos reales de un componente               | `get_contract_specs`                            |
| Grafo de dependencias de componente               | `get_component_graph`                           |
| Dependientes (impacto inverso)                    | `get_legacy_impact`                             |
| Deuda / duplicados / código muerto / seguridad    | `get_project_analysis` (con `mode`)             |
| Archivos candidatos para feature/refactor         | `get_modification_plan`                         |
| "Dónde se menciona X" (término suelto)            | `semantic_search` / `find_similar_implementations` |
| Pregunta abierta multi-fuente                     | `ask_codebase` (último recurso)                 |

**`ask_codebase` — `responseMode`:** `"default"` (prosa + ReAct), `"evidence_first"` (JSON MDD 7 claves), `"raw_evidence"` (+ `deterministicRetriever: true` sin LLM en retrieve; el cliente sintetiza). Acota con `scope` (`repoIds`, `includePathPrefixes`, `excludePathGlobs`).

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** No uses `ask_codebase` solo para "abrir" un archivo o buscar un símbolo conocido: es la opción más cara en tokens/latencia.
- **Regla 2:** Con sharding activo, `semantic_search` exige `projectId` explícito; no infiere desde la ruta del IDE.
- **Regla 3:** `semantic_search` **no** acepta `scope` ni `currentFilePath`; para acotar a un repo pasa su `roots[].id` como `projectId`. El `scope` (repoIds/prefijos/globs) va en `ask_codebase` y `get_modification_plan`.
- **Regla 4:** `get_modification_plan` es una **pista**, no lista exhaustiva: cruza con `rg`/grep para literales (clases, imports).
- **Regla 5:** Si los resultados parecen viejos, comprueba `get_sync_status` antes de confiar en ellos.
