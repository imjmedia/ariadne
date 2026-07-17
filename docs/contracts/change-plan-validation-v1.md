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
| `tasks` | no | Task items for coverage checks |
| `referencePlan` | no | Gate-1 output from `get_modification_plan` |
| `scope` | no | Same as modification-plan (`repoIds`, prefixes, globs) |

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

- **BLOCKED** if any check fails: `FILE_EXISTS`, `SYMBOL_UNRESOLVED`, `INDEX_STALE`, `ENDPOINT_REMOVE_UNSAFE` (when graph dependents exist), `RECOMPUTE_GAP` (>3 missing files and overlap <25%), `REFERENCE_OVERLAP` (<25%)
- **APPROVED_WITH_WARNINGS** if only warnings (low overlap, shared components, extra paths)
- **APPROVED** otherwise

See `services/ingest/src/plan-validation/` for implementation.
