---
id: refactor-seguro
title: Refactor seguro con MCP
category: Guías
last_updated: 2026-07-17
---

# Refactor seguro (SDD + dos gates)

## Secuencia obligatoria

```typescript
await list_known_projects();
const sync = await get_sync_status({ projectId: "<repo-id>" });
// if stale → resync in UI, then continue

const gate1 = await get_modification_plan({
  projectId: "<repo-id>",
  userDescription: "…",
});

const report = await validate_change_plan({
  projectId: "<repo-id>",
  ...gate1.changePlanTemplate,
  referencePlan: { filesToModify: gate1.filesToModify },
});
// if report.verdict === "BLOCKED" → STOP

await validate_before_edit({ nodeName: "Foo", projectId: "<repo-id>" });
await get_references({ symbolName: "Foo", projectId: "<repo-id>" });
// edit …
await detect_changes({ mode: "staged" });
```

## Checks por tipo de cambio

| Cambio           | Tool                       | Notas                                      |
| ---------------- | -------------------------- | ------------------------------------------ |
| Multi-archivo    | Gate 1 + Gate 2            | Obligatorio                                |
| Renombrar        | `get_references`           | Antes de aplicar                           |
| Props / firma    | `check_breaking_changes`   | `removedParams`, `removedFunctionParams`   |
| Endpoint remove  | Gate 2 `apiChanges`        | Bloquea si hay dependientes en grafo       |
| Frescura         | `get_sync_status`          | Gate 2 falla con `INDEX_STALE`             |
