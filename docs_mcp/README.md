# docs_mcp/

Structured documentation corpus served to AI agents by **`services/mcp-docs`**
(see `services/mcp-docs/README.md`). Each Markdown file is an *atomic* page following
[`DOCUMENTATION_TEMPLATE.md`](./DOCUMENTATION_TEMPLATE.md).

## MCP exposure

| On disk                        | MCP resource / tool                    |
| ------------------------------ | -------------------------------------- |
| `docs_mcp/<section>/<file>.md` | `docs://<section>/<id>`                |
| whole tree                     | `docs://manifest` (JSON index)         |
| `AI Context Brief` blockquote  | `summary` in manifest + search ranking |

`DOCUMENTATION_TEMPLATE.md` and `README.md` files are excluded from the corpus.

## Sections

- `arquitectura/` — platform layout (`services-layout`), `mcp-ariadne-overview` vs `docs-mcp-server`, `ingest-y-sharding`, `navigation-map`.
- `guias/` — agent workflows (`agent-workflow`), brownfield Forge MCP (`brownfield-forge-mcp`), consuming the Docs MCP (`consumir-docs-mcp`), graph tool catalog (`graph-tools-catalog`), safe refactor (`refactor-seguro`).

## Relation to other docs

- Human docs: `docs/` (manual, notebooklm specs).
- Agent onboarding (grafo): root `AGENTS.md`.
- **This folder** is optimized for MCP consumption (atomic pages, frontmatter, API tables).

Add pages freely; the server reloads on file changes (mtime).
