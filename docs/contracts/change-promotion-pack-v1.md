# Change Promotion Pack — Contract v1.1

JSON que **Ariadne** envía a The Forge al promover una conversación de chat (`POST /conversations/:id/promote-to-theforge`).

## Fields

| Field | Description |
|-------|-------------|
| `schemaVersion` | `"1.1"` |
| `source` | `"ariadne"` |
| `kind` | `"change_promotion"` |
| `generatedAt` | ISO timestamp |
| `idempotencyKey` | `sha256(conversationId + stageKey + commitSha?)` |
| `ariadne` | Contexto indexación (ver abajo) |
| `change` | Intención del cambio desde el hilo |
| `mdd` | MDD 7§ (evidencia as-is) |
| `modificationPlan` | `{ filesToModify: [{ path, repoId? }], questionsToRefine? }` |
| `deliverablesRequested` | Ver enum abajo |

### `ariadne`

```json
{
  "conversationId": "uuid",
  "conversationTitle": "Reingeniería BD",
  "repositoryId": "uuid-or-null",
  "projectId": "uuid-falkor",
  "projectKey": "kreodevs",
  "repoSlug": "theforge",
  "commitSha": "abc123",
  "indexFresh": true,
  "indexStaleHours": 12.5
}
```

### `change`

```json
{
  "title": "Reingeniería BD v2",
  "stageKey": "REING_BD_V2",
  "userDescription": "Resumen sintetizado ≤2000 chars",
  "decisions": ["Usar Prisma migrate", "Fase expand-contract"],
  "erDiagramMermaid": "erDiagram\n  ...",
  "migrationNotes": "markdown agregado de mensajes user"
}
```

### `deliverablesRequested`

`change_spec` | `data_model` | `api_contracts` | `modification_plan` | `migration_tasks` | `mdd_full`

## Consumer (The Forge)

HTTP: `POST /theforge/create-stage-from-ariadne-change-pack` — ver `docs/contracts/theforge-create-stage-from-pack-v1.md`.

El mapper `forge-create-stage.mapper.ts` transforma este JSON interno al `pack.version: "1"` de Forge.
