# Change Plan Validation — Contract v1

Canonical JSON contract for **`validate_change_plan`** (Ariadne MCP + ingest REST).

## Input — `ChangePlan`

| Field | Required | Description |
|-------|----------|-------------|
| `schemaVersion` | yes | `"1.0"` |
| `projectId` | yes | Ariadne project UUID or `roots[].id` (multi-root) |
| `source` | yes | `theforge` \| `cursor` \| `ci` \| `mcp` |
| `changeDescription` | no | Used to recompute reference files via modification-plan |
| `changeScope` | no | Structured scope from The Forge legacy interview |
| `files` | yes | Files the plan claims to touch |
| `apiChanges` | no | Declared API delta |
| `tasks` | no | Task items for coverage + semantics checks |
| `referencePlan` | no | Gate-1 output from `get_modification_plan` |
| `scope` | no | Same as modification-plan (`repoIds`, prefixes, globs) |

### `tasks[]` fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | yes | Human title |
| `files` | yes | Paths touched by the task |
| `id` | no | Stable id (`T1`…) for `dependsOn` |
| `symbols` | no | Graph symbols |
| `endpoints` | no | `METHOD /path` strings |
| `phase` | no | e.g. `1-core`, `2-integrate`, `3-validate` |
| `criterion` | no | Acceptance criterion |
| `evidence` | no | `{ kind: path\|symbol\|endpoint\|prop, ref }` citations |
| `dependsOn` | no | Other task ids |

## Output — `PlanValidationReport`

| Field | Description |
|-------|-------------|
| `verdict` | `APPROVED` \| `APPROVED_WITH_WARNINGS` \| `BLOCKED` |
| `score` | 0–100 |
| `checks` | Deterministic check results |
| `fileResults` | Per-file graph validation |
| `coverage` | `missingFromPlan`, `extraInPlan`, `referenceOverlapRatio` |
| `blockers` / `warnings` | Human-readable lists |
| `suggestedFixes` | Action hints |

## Verdict rules

- **BLOCKED** if any check fails: `FILE_EXISTS`, `SYMBOL_UNRESOLVED`, `INDEX_STALE`, `ENDPOINT_REMOVE_UNSAFE` (when graph dependents exist), `RECOMPUTE_GAP` (>3 missing files and overlap <25%), `REFERENCE_OVERLAP` (<25%), `TASK_DEPENDS_ON` (unknown ids)
- **APPROVED_WITH_WARNINGS** if only warnings (low overlap, shared components, extra paths, missing `criterion`/`phase`, unresolved `evidence`)
- **APPROVED** otherwise

## Post-deliverable validation (Forge)

`POST /projects/:projectId/validate-tasks-json` accepts Forge `tasksJson` (or `{ tasks: [...] }`), maps to `ChangePlan`, and runs the same Gate 2. If `verdict === BLOCKED`, Forge must not accept `migration_tasks`.

See `services/ingest/src/plan-validation/` for implementation.
