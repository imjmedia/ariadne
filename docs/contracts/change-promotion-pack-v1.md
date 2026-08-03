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
| `graphEvidenceBundle` | Evidencia por archivo (símbolos, dependents, props, APIs) |
| `changePlanSeed` | `ChangePlan` con tasks pre-sembrados (fase/criterio/evidencia) |
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

El mapper `forge-create-stage.mapper.ts` transforma este JSON interno al `pack.version: "1"` de Forge e incluye handoff items:

| `kind` | Contenido |
|--------|-----------|
| `mdd_evidence` | MDD JSON |
| `modification_plan_enriched` | `graphEvidenceBundle` |
| `change_plan_seed` | `changePlanSeed` |
| `change_work_description` | Markdown descripción completa del trabajo (Ariadne) |
| `cursor_tasks_markdown` | Documento `# Tasks` (YAML + checklist; Backend/Frontend/Infra/Testing/Deploy) |
| `post_deliverable_gate` | Instrucción + endpoint `validate-tasks-json` (si hay `migration_tasks`) |
| `deliverable_request` | Cada deliverable pedido |
| `er_diagram` | Mermaid si existe |

Cada `handoffItem` incluye **`id`** (`NEW-LEG-01`, `NEW-LEG-02`, … — regex Forge `^NEW-LEG-\d{2,}$`), **`title`** y **`description`** (1–4000 chars). Los campos `kind`, `content` y `mimeType` son metadatos Ariadne en el mapper; Forge valida con `integrationHandoffItemSchema` y persiste título/descripción en el snapshot.

Tras `legacy_generate_deliverables`, Forge debe llamar `POST /projects/:id/validate-tasks-json` y **bloquear** si `verdict === BLOCKED`.
