---
id: consumir-docs-mcp
title: Cómo consumir el Docs MCP desde un agente
category: Guías
last_updated: 2026-06-29
---

# Cómo consumir el Docs MCP desde un agente

> **AI Context Brief:** Flujo recomendado para navegar la documentación de Ariadne sin saturar la ventana de contexto: manifest → página concreta → herramientas puntuales.

## 1. Uso Básico (Quick Start)

```typescript
// 1) Descubrir qué existe:
//    recurso docs://manifest

// 2) Leer SOLO la página necesaria:
//    recurso docs://arquitectura/mcp-ariadne-overview

// 3) Búsqueda cuando no conoces la URI:
//    tool search_docs { "query": "validar antes de editar", "limit": 5 }

// 4) Contrato atómico (Props/Tipos/Uso):
//    tool get_component_api { "componentName": "…" }  // para fichas de componentes
```

## 2. API & Contrato de Tipos (Specs)

| Paso | Acción MCP                         | Cuándo                                                  |
| ---- | ---------------------------------- | ------------------------------------------------------- |
| 1    | `docs://manifest`                  | Siempre primero; índice barato en tokens.               |
| 2    | `docs://<section>/<topic>`         | URI conocida desde manifest o búsqueda.                 |
| 3    | `search_docs(query)`               | Tema desconocido / palabras clave.                      |
| 4    | `get_component_api(name)`          | Solo contrato de un componente documentado.             |

**Combinación con el grafo:** usa `mcp-docs` para documentación del **proyecto Ariadne**; usa `mcp-ariadne` para código **indexado de repos clientes**.

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** No sustituyas `semantic_search` del grafo por `search_docs`; cubren corpus distintos.
- **Regla 2:** Empieza por el manifest; evita leer páginas completas «por si acaso».
- **Regla 3:** Si una URI no existe, relee `docs://manifest` en vez de adivinar secciones/topics.
