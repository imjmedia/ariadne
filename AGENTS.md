# AGENTS.md — Ariadne Codebase Intelligence

You have access to **Ariadne MCP** — a knowledge graph of this codebase powered by FalkorDB. It knows every component, function, route, model, import, and prop contract. Use it **before** writing code, not after.

## First steps (every session)

```
list_known_projects()
```

This gives you project IDs, repo names, and branches. Use the `roots[].id` (repo ID) as `projectId` in multi-root projects, not the project UUID. If you're editing a file, pass `currentFilePath` instead — the server infers the project.

## Core workflow

```
1. semantic_search("what you're looking for") → find relevant code
2. get_file_context(filePath) or get_file_content(path) → read the file
3. validate_before_edit(nodeName) → check impact + contract
4. Edit the code
5. analyze_local_changes() → pre-commit blast radius check
```

## Tool catalog

### Discovery (find things)
- **`semantic_search`** — Hybrid vector+keyword search. Most common entry point. Pass `query` + optional `projectId`/`limit`.
- **`find_similar_implementations`** — Before writing a new function, check if something similar already exists.
- **`ask_codebase`** — Natural language Q&A over the codebase. Requires `question`. Pass `responseMode: "raw_evidence"` for structured JSON. **Route to cheaper tools** (get_file_content, get_definitions) when you already know the path/symbol.
- **`list_known_projects`** — All indexed projects with IDs and branches.

### Read code
- **`get_file_content`** — Fetch file contents from Bitbucket/GitHub. Requires `path`. Optional: `projectId`, `ref` (branch).
- **`get_file_context`** — File contents + its imports + exports. Use as step 2 after finding a file.
- **`get_definitions`** — Where a symbol is defined (file, line numbers). Avoids hallucinating locations.
- **`get_references`** — Every place that uses a symbol. Critical before renaming.
- **`get_implementation_details`** — Props, signatures, descriptions, endpoints for a component/function.
- **`get_functions_in_file`** — List all functions/components inside a specific file.

### Graphs & architecture
- **`get_component_graph`** — Dependency tree (RENDERS, IMPORTS, USES_HOOK). Uses Nest API with auth forwarding.
- **`get_legacy_impact`** — Dependents of a node (who calls/renders it).
- **`get_import_graph`** — What a file imports and exports.
- **`generate_navigation_map`** — Full frontend route map with components, forms, and API endpoints. Supports diff mode.
- **`extract_design_tokens`** — Parse Tailwind/CSS tokens into structured JSON.

### Impact analysis (before editing)
- **`validate_before_edit`** — **MANDATORY** before touching any component/function. Returns dependents + prop contract.
- **`get_affected_scopes`** — Full blast radius: which files/nodes break if you modify X.
- **`check_breaking_changes`** — Alerts if you're about to remove a parameter still in use.
- **`get_contract_specs`** — Real prop names and types from the graph. Force the AI to use correct names.

### Code health
- **`trace_reachability`** — Find dead code (unreachable from entry points like routes/index/main).
- **`check_export_usage`** — Exports with no imports anywhere in the monorepo.
- **`get_debt_report`** — Orphan nodes dead code + structural complexity report.
- **`find_duplicates`** — Identical files by content hash.
- **`get_project_analysis`** — Full analysis: `diagnostico`, `duplicados`, `reingenieria`, `codigo_muerto`, `seguridad`.

### Planning & review
- **`get_modification_plan`** — Returns `filesToModify` + business questions. Multi-root: pass `roots[].id`.
- **`analyze_local_changes`** — Pre-commit: runs `git diff --cached` against the knowledge graph. Returns impact score per change.
- **`review_diff`** — Review any diff or PR URL with legacy context enrichment.
- **`get_sync_status`** — Is the graph up to date? Check before trusting results.
- **`get_project_standards`** — Prettier, ESLint, tsconfig snippets. Make new code indistinguishable.

## Rules

1. **Always validate before editing** — `validate_before_edit` on the node you're about to touch. No exceptions.
2. **Resolve projectId early** — Cache it. Every tool that accepts `projectId` works better with it.
3. **Multi-root projects** — Pass `roots[].id` (repo ID) as `projectId`, not the project UUID. Use `currentFilePath` to let the server resolve it.
4. **Route to cheap tools** — If you know the symbol/path, use `get_file_content`/`get_definitions`/`get_references` instead of `ask_codebase`. Less latency, fewer tokens.
5. **Check for duplicates before writing** — `find_similar_implementations` before implementing anything new.
6. **Pre-commit review** — `analyze_local_changes()` before every commit to catch broken dependencies.
7. **Graph freshness** — If results look stale, `get_sync_status` to check when the project was last indexed.
