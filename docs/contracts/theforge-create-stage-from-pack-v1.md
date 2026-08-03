# The Forge — create_stage_from_ariadne_change_pack (v1)

HTTP en **The Forge** (consumidor: Ariadne ingest).

## Endpoint

`POST /theforge/create-stage-from-ariadne-change-pack`

Auth: `Authorization: Bearer {service JWT}` (mismo patrón que converge).

## Request

```json
{
  "forgeProjectId": "uuid-workshop",
  "pack": {
    "version": "1",
    "changeDescription": "…",
    "ariadneChangeId": "REING_BD_V2",
    "ariadneRepositoryId": "uuid-repo",
    "ariadneProjectId": "uuid-falkor",
    "ariadneConversationId": "uuid-conv",
    "idempotencyKey": "sha256…",
    "filesToModify": [{ "path": "src/foo.ts", "repoId": "…" }],
    "questionsToRefine": ["…"],
    "handoffItems": [
      {
        "id": "NEW-LEG-01",
        "description": "MDD Ariadne",
        "kind": "mdd_evidence",
        "title": "MDD Ariadne",
        "content": "{…}",
        "mimeType": "application/json"
      }
    ],
    "linkedNewProjectId": "uuid-new"
  },
  "stageId": "uuid-existing-stage",
  "stageName": "Reingeniería BD v2",
  "activate": true,
  "runLegacyStart": false,
  "wireAriadne": true
}
```

### Comportamiento Forge

| Regla | Detalle |
|-------|---------|
| Proyecto | Solo **LEGACY** |
| Sin `stageId` | Crea etapa nueva |
| Con `stageId` | Importa en etapa existente (ordinal ≥ 2) |
| Persistencia | `legacyChangeState` (+ `handoffSnapshot` si hay `handoffItems`) |
| `wireAriadne` | Brownfield auto-wire + upsert `project_ariadne_links` |
| `runLegacyStart` | Default `false` si el pack trae `filesToModify`; si no, respeta `LEGACY_HANDOFF_AUTO_LEGACY_START` |

Ariadne envía por defecto: `wireAriadne: true`, `runLegacyStart: false` cuando hay archivos en el plan.

## Response (200)

```json
{
  "forgeProjectId": "uuid",
  "stageId": "uuid-stage",
  "stageName": "…",
  "stageKey": "REING_BD_V2",
  "stageUrl": "https://…",
  "importMode": "create",
  "legacyStart": { "triggered": false, "skipped": true },
  "ariadneWire": { "linked": true, "linkKind": "primary" },
  "recommendedNextTools": [
    "legacy_answer",
    "legacy_generate_mdd",
    "legacy_generate_deliverables",
    "validate_change_plan_via_ariadne"
  ]
}
```

Cuando el pack pide `migration_tasks`, Ariadne añade `validate_change_plan_via_ariadne` y un handoff `post_deliverable_gate` apuntando a `POST /projects/:projectId/validate-tasks-json`.

## Flujo recomendado (Ariadne → Forge)

1. `POST /theforge/resolve-forge-project-for-ariadne`
2. `POST /theforge/create-stage-from-ariadne-change-pack`
3. Tools legacy en Forge según `recommendedNextTools` (con `stageId`)
4. Tras `legacy_generate_deliverables` → `POST Ariadne /projects/:id/validate-tasks-json` con `tasksJson`; si `BLOCKED`, no cerrar el deliverable

## Mapping interno Ariadne

El ingest construye el pack interno v1.1 (`ChangePromotionPackService`) con `graphEvidenceBundle` + `changePlanSeed` y lo transforma con `forge-create-stage.mapper.ts` antes del POST.

Ver también: `docs/contracts/change-promotion-pack-v1.md` (formato interno).
