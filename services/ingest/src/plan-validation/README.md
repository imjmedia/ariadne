# Plan validation (Gate 2)

Deterministic audit of a structured **ChangePlan** against FalkorDB.

## Endpoints

| Route | Purpose |
|-------|---------|
| `POST /projects/:projectId/validate-change-plan` | Validate a full `ChangePlan` |
| `POST /projects/:projectId/validate-tasks-json` | Map Forge `tasksJson` → `ChangePlan` then validate |

## Modules

- `change-plan-validation.types.ts` — `ChangePlan`, `ChangePlanTask` (`phase`, `criterion`, `evidence`, `dependsOn`)
- `change-plan-validation.service.ts` — file/symbol/API checks + task semantics
- `forge-tasks-json.mapper.ts` — Forge deliverable → Ariadne plan

Contract: `docs/contracts/change-plan-validation-v1.md`.
