---
id: docs-mcp-server
title: Docs MCP Server
category: Arquitectura
last_updated: 2026-06-29
---

# Docs MCP Server (`services/mcp-docs`)

> **AI Context Brief:** Servidor MCP (SDK oficial) que sirve la carpeta `docs_mcp/` de Ariadne a agentes de IA como recursos `docs://…` y herramientas `search_docs` / `get_component_api`; complementa `mcp-ariadne` (grafo de código).

## 1. Uso Básico (Quick Start)

```bash
# Build + stdio (Cursor):
pnpm -C services/mcp-docs build
node services/mcp-docs/dist/index.js

# HTTP streamable (Docker / Dokploy):
node services/mcp-docs/dist/index.js --http --port 8081
# GET /health  ->  { status, totalPages }

# Cursor .cursor/mcp.json:
{
  "mcpServers": {
    "ariadne-docs": {
      "command": "node",
      "args": ["services/mcp-docs/dist/index.js"]
    }
  }
}
```

## 2. API & Contrato de Tipos (Specs)

| Recurso / Tool                   | Descripción                                                         |
| -------------------------------- | ------------------------------------------------------------------- |
| `docs://manifest`                | JSON con índice completo (secciones, topics, summaries).            |
| `docs://<section>/<topic>`       | Página Markdown limpia (sin frontmatter).                           |
| `search_docs({ query, limit? })` | Búsqueda por palabras clave con fragmentos rankeados.               |
| `get_component_api({ componentName })` | Solo Uso Básico + API/Props + Decisiones de una ficha.        |

| Variable       | Default    | Descripción                    |
| -------------- | ---------- | ------------------------------ |
| `DOCS_MCP_DIR` | autodetect | Raíz de la documentación.      |
| `PORT`         | `8081`     | Puerto en modo `--http`.       |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** **No confundir** con `services/mcp-ariadne`: ese sirve el **grafo de código indexado** (FalkorDB); este sirve **documentación estática** del propio proyecto Ariadne.
- **Regla 2:** El `src/` es idéntico al de The Forge (`packages/docs-mcp-server`); sin dependencias de workspace para mantener paridad.
- **Regla 3:** En stdio, stdout es JSON-RPC; logs solo a stderr.
- **Regla 4:** El corpus se recarga al detectar cambios (mtime); editar `docs_mcp/` no requiere reiniciar.
