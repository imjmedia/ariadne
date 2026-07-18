# The Forge — resolve_forge_project_for_ariadne (v1)

MCP tool / HTTP en **The Forge** (consumidor: Ariadne ingest).

## Endpoint

`POST /theforge/resolve-forge-project-for-ariadne`

Auth: `Authorization: Bearer {service JWT}`

## Input

Al menos un identificador fuerte:

```json
{
  "ariadneProjectId": "uuid-opcional",
  "ariadneRepositoryId": "uuid-opcional",
  "projectKey": "kreodevs",
  "repoSlug": "theforge",
  "gitRemoteUrl": "https://github.com/kreodevs/theforge.git"
}
```

## Output (200)

```json
{
  "forgeProjectId": "uuid",
  "forgeProjectName": "The Forge",
  "linkKind": "primary",
  "existingStages": [
    { "id": "uuid", "name": "Legacy baseline", "workflowStatus": "ACTIVE" }
  ],
  "warnings": []
}
```

`linkKind`: `primary` | `alias` | `inferred`.

## Errores

| Código | Body | UI Ariadne |
|--------|------|------------|
| 404 | `{ "message": "no link" }` | Modal selector de proyectos Forge |
| 409 | `{ "candidates": [{ "forgeProjectId", "forgeProjectName", "linkKind" }] }` | Usuario elige uno |

## Persistencia del vínculo

Tabla en **The Forge**: `project_ariadne_links` (`project_id`, `ariadne_project_id`, `ariadne_repository_id`, `git_remote`, `is_primary`).

Ariadne **no** duplica esta tabla; opcionalmente cachea `forge_project_id` en `chat_conversations` tras promoción exitosa.
