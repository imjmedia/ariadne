---
id: refactor-seguro
title: Refactor seguro (SDD)
category: Guías
last_updated: 2026-06-29
---

# Refactor seguro con el grafo (SDD)

> **AI Context Brief:** Secuencia de herramientas MCP para refactorizar sin romper dependientes en repos indexados por Ariadne; léelo antes de renombrar/cambiar APIs públicas o de commitear.

## 1. Uso Básico (Quick Start)

```typescript
// Antes de tocar un símbolo público:
await validate_before_edit({ nodeName: "AuthGuard", projectId: "<repo-id>" });
await get_references({ nodeName: "AuthGuard", projectId: "<repo-id>" }); // antes de renombrar
await get_affected_scopes({ nodeName: "AuthGuard", projectId: "<repo-id>" });

// Al cambiar firma:
await check_breaking_changes({ nodeName: "AuthGuard", projectId: "<repo-id>" });

// Antes del commit:
await analyze_local_changes(); // git diff --cached vs grafo
```

## 2. API & Contrato de Tipos (Specs)

| Fase             | Tool                       | Qué aporta                                            |
| ---------------- | -------------------------- | ----------------------------------------------------- |
| Pre-edición      | `validate_before_edit`     | Dependientes + contrato de props (obligatorio).       |
| Renombrar        | `get_references`           | Todos los call sites/imports del símbolo.             |
| Blast radius     | `get_affected_scopes`      | Archivos/nodos que rompen si modificas X.             |
| Cambio de firma  | `check_breaking_changes`   | Alerta si quitas un parámetro aún en uso.             |
| Nombres reales   | `get_contract_specs`       | Props/tipos exactos (evita alucinación).              |
| Pre-commit       | `analyze_local_changes`    | Impacto por cambio contra el grafo.                   |
| Revisión PR/diff | `review_diff`              | Revisa un diff/PR con contexto legacy.                |
| Frescura         | `get_sync_status`          | Si el grafo está actualizado.                         |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** `validate_before_edit` antes de tocar cualquier componente/función pública — sin excepciones.
- **Regla 2:** Antes de renombrar, `get_references`; antes de quitar parámetros, `check_breaking_changes`.
- **Regla 3:** `analyze_local_changes()` antes de cada commit para detectar dependientes rotos.
- **Regla 4:** Al extraer código a un archivo nuevo, los imports deben resolver desde el directorio del nuevo archivo; verifica con `get_definitions` y compila antes de confiar.
- **Regla 5:** Si el grafo devuelve "no encontrado" estructurado, no inventes contratos: re-sincroniza o corrige el `scope`/`projectId`.
