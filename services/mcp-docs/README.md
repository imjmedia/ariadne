# ariadne-docs-mcp (`services/mcp-docs`)

MCP server (official `@modelcontextprotocol/sdk`) that serves the project's
structured documentation corpus (`docs_mcp/`) to AI agents.

**Complements** `services/mcp-ariadne` (FalkorDB codebase graph) — use this server
for Ariadne platform docs; use `mcp-ariadne` for indexed customer repos.

## Resources & tools

| URI / tool                | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `docs://manifest`         | JSON index of all documentation pages.           |
| `docs://<section>/<topic>`| One Markdown page (frontmatter stripped).        |
| `search_docs`             | Keyword search with ranked snippets.             |
| `get_component_api`       | Usage + Props/Types + design rules only.         |

## Run

```bash
pnpm -C services/mcp-docs install
pnpm -C services/mcp-docs build

# stdio (Cursor):
node services/mcp-docs/dist/index.js

# HTTP:
node services/mcp-docs/dist/index.js --http --port 8081
```

## Cursor

```json
{
  "mcpServers": {
    "ariadne-docs": {
      "command": "node",
      "args": ["services/mcp-docs/dist/index.js"]
    }
  }
}
```

## Smoke test

```bash
pnpm -C services/mcp-docs build
node services/mcp-docs/scripts/smoke.mjs
```

## Docker

```bash
docker build -f services/mcp-docs/Dockerfile .
# Service `mcp-docs` in docker-compose.yml (port 8081, /health).
```

The `src/` is kept identical to The Forge `packages/docs-mcp-server` for parity.
