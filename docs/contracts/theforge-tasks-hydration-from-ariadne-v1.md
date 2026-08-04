# The Forge — Tasks hydration from Ariadne pack (v1)

**Status:** Spec for Forge implementation (Ariadne side ships `tasks_json_seed` handoff as of ingest mapper v1.1).

**Problem:** Integration batches NEW→LEG send executable tasks in Ariadne handoffs (`cursor_tasks_markdown`, NEW-LEG-06) but Forge only shows a **Handoff checklist** (8 titles). The native **Tasks** panel and MCP (`get_tasks_json`, `get_next_implementation_task`) read `tasksJson` v2 — which stays empty because Ariadne intentionally **does not** request `migration_tasks` (Forge would regenerate greenfield US baseline: login, campañas, infra).

**Goal:** On `POST /theforge/create-stage-from-ariadne-change-pack`, hydrate `legacyChangeState.tasksJson` (and optional `tasksContent`) so devs and agents see T-001, T-002… in the Tasks UI without running `legacy_generate_deliverables` for `migration_tasks`.

---

## Inputs (from Ariadne pack)

| Priority | Source | `handoffItems[].kind` | Format |
|----------|--------|----------------------|--------|
| 1 | Human/agent doc | `cursor_tasks_markdown` | Markdown `# Tasks` (YAML blocks + checklists) |
| 2 | Structured seed | `tasks_json_seed` | JSON — Forge tasksJson v2 (derived from markdown in Ariadne) |
| 3 | Graph evidence | `change_plan_seed` | Ariadne ChangePlan v1.0 (enrichment / blast radius) |

**Integration scope metadata** (`handoffItems` kind `integration_scope`, JSON):

```json
{
  "mode": "integration_handoff",
  "taskSource": "cursor_tasks_markdown",
  "taskSourceFallback": "tasks_json_seed",
  "taskSourceGraph": "change_plan_seed",
  "skipBaselineDeliverables": [
    "migration_tasks",
    "change_spec",
    "data_model",
    "mdd_full"
  ],
  "linkedNewProjectId": "uuid-new",
  "acceptanceCriteria": ["…"]
}
```

When `taskSource` is set, Forge **must not** auto-run `legacy_generate_deliverables` for `migration_tasks` on this stage.

---

## `tasks_json_seed` payload (Ariadne → Forge)

```json
{
  "schemaVersion": "2",
  "source": "ariadne",
  "projectId": "uuid-falkor",
  "changeDescription": "Wiring costos NEW→LEG …",
  "ariadneChangeId": "INT_COSTOS_V1",
  "promotionScope": "integration_handoff",
  "tasks": [
    {
      "id": "T-001",
      "title": "Wire costos API en catálogo",
      "files": ["frontend/src/pages/Catalogo/CatalogoPage.tsx"],
      "symbols": ["CatalogoPage"],
      "phase": "1-core",
      "criterion": "Mostrar costos en previsualizador",
      "evidence": [{ "kind": "symbol", "ref": "CatalogoPage" }],
      "dependsOn": [],
      "status": "pending",
      "source": "ariadne_change_plan_seed"
    }
  ],
  "files": [
    { "path": "frontend/src/pages/Catalogo/CatalogoPage.tsx", "repoId": "uuid-repo" }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `schemaVersion` | yes | `"2"` |
| `source` | yes | Always `"ariadne"` |
| `projectId` | yes | Ariadne Falkor project UUID |
| `tasks[].id` | yes | Stable id (`T-001`, …) — same ids as `# Tasks` markdown when possible |
| `tasks[].title` | yes | Short imperative title |
| `tasks[].files` | yes | At least one path per task |
| `tasks[].status` | no | Default `pending` |
| `files` | yes | Union of task paths (+ optional `repoId`) |

Ariadne builds this in `forge-tasks-json-seed.util.ts` from `changePlanSeed.tasks`, falling back to `modificationPlan.filesToModify`.

---

## Forge algorithm (create-stage import)

Pseudocode for handler of `create-stage-from-ariadne-change-pack`:

```
function hydrateTasksFromAriadnePack(pack, stage):
  scope = findHandoff(pack, kind='integration_scope')
  tasksSeed = findHandoff(pack, kind='tasks_json_seed')
  cursorMd = findHandoff(pack, kind='cursor_tasks_markdown')

  if scope?.taskSource == 'tasks_json_seed' and tasksSeed?.content:
    tasksJson = JSON.parse(tasksSeed.content)
    if validateTasksJsonV2(tasksJson):
      stage.legacyChangeState.tasksJson = tasksJson
      stage.legacyChangeState.tasksSource = 'ariadne_tasks_json_seed'
      if cursorMd?.content:
        stage.legacyChangeState.tasksContent = cursorMd.content
      persist(stage)
      return { hydrated: true, source: 'tasks_json_seed' }

  if cursorMd?.content:
    parsed = parseCursorTasksMarkdown(cursorMd.content)  // existing or new parser
    if parsed?.tasks?.length:
      stage.legacyChangeState.tasksJson = parsed
      stage.legacyChangeState.tasksContent = cursorMd.content
      stage.legacyChangeState.tasksSource = 'ariadne_cursor_tasks_markdown'
      persist(stage)
      return { hydrated: true, source: 'cursor_tasks_markdown' }

  return { hydrated: false }
```

### Validation (`validateTasksJsonV2`)

- `schemaVersion === "2"`
- `tasks` is non-empty array
- Each task has `id`, `title`, and at least one `files[]` entry
- Optional: call Ariadne Gate 2 `POST /projects/:projectId/validate-tasks-json` with the payload (warn-only on import; block only if configured)

### UI

After hydration:

1. **Tasks panel** — render `tasksJson.tasks` with checkboxes (same component as post-`migration_tasks` cascade).
2. **Handoff panel** — keep existing NEW-LEG checklist; optionally link “Ver tareas” → Tasks tab.
3. **`cursor_tasks_markdown` handoff** — render as Markdown preview (P1), not raw JSON.

### MCP

- `get_tasks_json` → return hydrated `tasksJson` (`tasksSource: 'ariadne_tasks_json_seed' | 'ariadne_cursor_tasks_markdown'`)
- `get_next_implementation_task` → first task with `status !== 'done'`

### `recommendedNextTools`

When `integration_scope.mode === 'integration_handoff'` and tasks hydrated:

```json
["legacy_answer", "get_tasks_json", "get_next_implementation_task"]
```

Do **not** include `legacy_generate_deliverables` for `migration_tasks` unless user explicitly requests it.

---

## Markdown fallback parser (`cursor_tasks_markdown`)

If `tasks_json_seed` is missing or invalid, parse `# Tasks` markdown:

1. Split on `## Backend tasks`, `## Frontend tasks`, etc.
2. For each YAML block between `---` fences, extract: `id`, `title`, `section`, `depends_on`, `scope.include[]`.
3. Map `scope.include` → `files[]`; derive `phase` from `### Fase N` heading.
4. Emit tasksJson v2 with same shape as seed.

Reference format: Ariadne `cursor-tasks-document.util.ts` (`buildTaskBlock`).

---

## Idempotency / re-import

- Re-import same `idempotencyKey`: do not duplicate tasks; merge by task `id` (Ariadne wins if status still `pending`).
- Import into existing `stageId` (ordinal ≥ 2): append handoffs; replace `tasksJson` only if incoming pack has newer `generatedAt` or explicit `forceTasksRefresh`.

---

## Acceptance criteria (Forge)

- [ ] After create-stage from integration batch, **Tasks panel** shows ≥1 task with file paths (not empty).
- [ ] `get_tasks_json` returns `hasTasksJson: true`, `tasksSource: ariadne_*`.
- [ ] Handoff checklist unchanged (8 items); NEW-LEG item for `tasks_json_seed` visible.
- [ ] No auto-generation of greenfield user stories when `skipBaselineDeliverables` includes `migration_tasks`.
- [ ] Fallback: if only `cursor_tasks_markdown` present, Tasks panel still populates via parser.

---

## Ariadne references

| Artifact | Path |
|----------|------|
| Seed builder | `services/ingest/src/theforge/forge-tasks-json-seed.util.ts` |
| Handoff mapper | `services/ingest/src/theforge/forge-create-stage.mapper.ts` |
| Gate 2 reverse map | `services/ingest/src/plan-validation/forge-tasks-json.mapper.ts` |
| Internal pack contract | `docs/contracts/change-promotion-pack-v1.md` |

---

## Example handoff order (integration batch)

| ID | kind | Title |
|----|------|-------|
| ARIADNE-ART-01 | `integration_scope` | Alcance integración NEW→LEG |
| ARIADNE-ART-02 | `mdd_evidence` | MDD legacy (resumen alcance) |
| ARIADNE-ART-03 | `modification_plan_enriched` | Modification plan graph evidence |
| ARIADNE-ART-04 | `change_plan_seed` | ChangePlan seed (tasks + symbols) |
| ARIADNE-ART-05 | **`tasks_json_seed`** | **Tasks JSON seed (derivado del markdown)** |
| ARIADNE-ART-06 | `change_work_description` | Descripción del trabajo (Ariadne) |
| ARIADNE-ART-07 | **`cursor_tasks_markdown`** | **Tareas Cursor (# Tasks) — SSOT ejecutable** |
| ARIADNE-ART-08 | `deliverable_request` | modification_plan |
| ARIADNE-ART-09 | `deliverable_request` | api_contracts |

*(Business traces from project NEW remain `NEW-LEG-NN`; pack artifacts use `ARIADNE-ART-NN`.)*
