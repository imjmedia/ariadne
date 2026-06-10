# SKILL.md — Ariadne Codebase Intelligence

## When to use this skill

You are working on a codebase indexed by **Ariadne MCP** — a FalkorDB-powered knowledge graph that tracks every component, function, route, model, import, prop, and endpoint. Load this skill when: you need to understand code you didn't write, refactor safely, find dead code, avoid duplication, or validate changes before committing.

**This skill is self-contained.** You don't need AGENTS.md or any other file. Everything you need to use Ariadne effectively is here.

## First call every session

```
list_known_projects()
```

Returns project IDs, repo names, and branches. In multi-root projects, use `roots[].id` (the repo ID) as `projectId`, not the top-level project UUID. If you're already editing a file, pass `currentFilePath` instead of `projectId` — the server resolves it automatically.

## The 7 rules

1. **Validate before editing** — Call `validate_before_edit(nodeName)` on **every** component or function before touching it. No exceptions. It returns dependents and the prop contract so you don't break things.

2. **Cache the projectId** — Resolve it once from `list_known_projects` or `currentFilePath` inference. Every tool accepts it and works better with it.

3. **Multi-root = repo ID, not project UUID** — For `get_modification_plan`, `semantic_search`, `ask_codebase`, etc., pass `roots[].id` (the repository ID) as `projectId`. The project UUID scopes too broadly in monorepos.

4. **Route to cheap tools** — If you know the path or symbol name, use `get_file_content`, `get_definitions`, or `get_references`. Reserve `ask_codebase` for open-ended questions where you don't know what you're looking for.

5. **Check for duplicates before writing** — `find_similar_implementations` before implementing any new utility, validator, or helper. It uses vector search against the codebase.

6. **Pre-commit review** — `analyze_local_changes(workspaceRoot)` before every commit. It runs `git diff --cached` against the graph and flags broken dependencies, orphaned code, and risky edits.

7. **Verify graph freshness** — If results look wrong or incomplete, call `get_sync_status(projectId)`. The graph may be stale.

## Tool reference

### Discovery

| Tool | Required params | What it does |
|------|----------------|--------------|
| `semantic_search` | `query` | Hybrid vector+keyword search. Your main discovery tool. |
| `find_similar_implementations` | `query` | Vector search for existing code similar to what you plan to write. |
| `ask_codebase` | `question` | Natural language Q&A. Set `responseMode: "raw_evidence"` for structured output. Slow/expensive — route to specific tools when possible. |
| `list_known_projects` | none | All indexed projects with IDs, names, repos, and branches. |

### Reading code

| Tool | Required params | What it does |
|------|----------------|--------------|
| `get_file_content` | `path` | Fetch file from Bitbucket/GitHub. Optional `ref` for branch. |
| `get_file_context` | `filePath` | File contents + its imports + its exports. |
| `get_definitions` | `symbolName` | Where a symbol is defined — file path and line numbers. |
| `get_references` | `symbolName` | Every location that uses a symbol. Essential before renaming. |
| `get_implementation_details` | `symbolName` | Props, signatures, descriptions, endpoint calls. |
| `get_functions_in_file` | `path` | All functions and components inside a file. |

### Architecture & graphs

| Tool | Required params | What it does |
|------|----------------|--------------|
| `get_component_graph` | `componentName` | Dependency tree (RENDERS, IMPORTS, USES_HOOK). Uses Nest API. |
| `get_import_graph` | `filePath` | What a file imports and exports. |
| `generate_navigation_map` | `projectId` | Full frontend route map: URLs, components, forms, API endpoints. Supports `scope: "diff"` for incremental updates. |
| `extract_design_tokens` | `projectId` | Tailwind/CSS tokens as structured JSON. |

### Impact & safety (before editing)

| Tool | Required params | What it does |
|------|----------------|--------------|
| `validate_before_edit` | `nodeName` | **MANDATORY.** Dependents + prop contract. Run before every edit. |
| `get_legacy_impact` | `nodeName` | Who calls or renders this node. Nest API with Falkor fallback. |
| `get_affected_scopes` | `nodeName` | Full blast radius: all files and tests affected by a change. |
| `check_breaking_changes` | `nodeName` | Warns if `removedParams` are still in use elsewhere. |
| `get_contract_specs` | `componentName` | Real prop names and types from the scanner. |

### Code health

| Tool | Required params | What it does |
|------|----------------|--------------|
| `trace_reachability` | `projectId` | Dead code: unreachable from entry points (routes, index, main). |
| `check_export_usage` | `projectId` | Exports with zero imports across the monorepo. |
| `get_debt_report` | `projectId` | Orphan nodes and structural complexity. |
| `find_duplicates` | `projectId` | Identical files by content hash. |
| `get_project_analysis` | none (optional `projectId`, `mode`) | Full analysis: `diagnostico`, `duplicados`, `reingenieria`, `codigo_muerto`, `seguridad`. |

### Planning & review

| Tool | Required params | What it does |
|------|----------------|--------------|
| `get_modification_plan` | `userDescription` | Returns `filesToModify` + `questionsToRefine`. |
| `analyze_local_changes` | none (optional `workspaceRoot` or `stagedDiff`) | Pre-commit: diff against graph, returns impact per change. |
| `review_diff` | none (optional `diff` or `prUrl`) | Review any diff or PR with legacy context. |
| `get_sync_status` | none (optional `projectId`) | Last sync timestamp and status. |
| `get_project_standards` | `projectId` | Prettier, ESLint, tsconfig config snippets. |

## Workflow patterns

### Pattern A: Implementing a feature

```
1. semantic_search(query="what you're building")
2. find_similar_implementations(query="same concept") ← avoid duplication
3. get_file_context(filePath) for each relevant file
4. get_implementation_details(symbolName) for key components
5. Write the code
6. validate_before_edit(nodeName) on any modified component
7. analyze_local_changes(workspaceRoot="/path/to/repo") ← pre-commit
```

### Pattern B: Refactoring / renaming

```
1. get_definitions(symbolName) ← where is it?
2. get_references(symbolName) ← who uses it?
3. get_legacy_impact(nodeName) ← dependency tree
4. get_affected_scopes(nodeName) ← full blast radius
5. validate_before_edit(nodeName) ← prop contract check
6. Refactor
7. analyze_local_changes() ← verify nothing broke
```

### Pattern C: Understanding unknown code

```
1. ask_codebase(question="what does X do?") OR semantic_search(query="X")
2. get_file_content(path) for the most relevant file
3. get_component_graph(componentName) if it's a component
4. get_implementation_details(symbolName) for the key symbol
5. get_functions_in_file(path) to see what else lives there
```

### Pattern D: Dead code cleanup

```
1. trace_reachability(projectId) ← unreachable from entry points
2. check_export_usage(projectId) ← exports nobody imports
3. get_debt_report(projectId) ← orphan nodes
4. For each candidate: get_references(symbolName) to double-check
5. Remove only if truly unused
```

## Error responses

Ariadne tools return `[NOT_FOUND_IN_GRAPH]` when a symbol or project isn't indexed. This means:
- The project hasn't been synced → call `get_sync_status`
- The symbol name is wrong → try `semantic_search` to find the correct name
- The file hasn't been scanned → check `get_functions_in_file` for that path

## Auth & configuration

The MCP server uses `INGEST_URL` for file/content fetching and Nest API calls. Auth tokens are forwarded from your IDE's MCP client configuration. No manual auth setup needed — it's configured once at the IDE/agent level.
