# C4 (Entregas 1–3)

Pipeline: dominios / docker-compose / Falkor → `C4Model` → Archify HTML.

## Niveles

| Nivel | Fuente | Generador |
| ----- | ------ | --------- |
| **context** | `project.domainId`, `project_domain_dependencies`, `domain_domain_visibility`, multi-root | `sync` o `hybrid` (LLM opcional) |
| **container** | `docker-compose`, workspaces | `sync` |
| **component** | Subgrafo Falkor por `pathPrefix` del container (`IMPORTS`, `RENDERS`, rutas web) | `sync` |

## Configuración

**Ajustes → Sistema → pestaña «C4 / Diagramas»** (`system_settings`):

| Campo | Efecto |
| ----- | ------ |
| **C4 habilitado** | MERGE `:System`/`:Container` en Falkor durante sync |
| **Generar tras full sync** | Snapshot Context + Container + HTML Archify al terminar sync |
| **Ruta Archify CLI** | Opcional; vacío = autodetect `/opt/archify` (Docker: release pin `ARCHIFY_VERSION` en Dockerfile) |

## API

- `GET /projects/:id/c4?level=context|container|component` — JSON `C4Model`
- `POST /projects/:id/c4/generate` — body `{ level?, levels?, useLlm?, containerKey? }`
- `GET /projects/:id/c4/html?level=…` — HTML Archify
- `GET /projects/:id/c4/snapshots?level=&limit=` — historial
- `GET /projects/:id/c4/diff?from=&to=` — diff JSON + HTML Archify compare

`detect_changes` incluye `c4TopologyChanged` si los dos últimos snapshots container difieren en `contentHash`.

`useLlm` solo aplica a **context**: añade actores `person` y descripciones con evidencia `source: llm` (requiere API key en Ajustes → IA).

## Secuencia API (3.2)

- `POST /projects/:id/c4/sequence/generate` — flujo Route → API → backend (Falkor)
- `GET /projects/:id/c4/sequence/html` — HTML Archify sequence

Antes de invocar Archify CLI, `C4ArchifyRenderer` aplica `c4-archify-ir-fix.ts` (ingest: labels `org/repo`, sin self-loops) y luego `sanitizeArchifySequenceIr` / `sanitizeArchifyArchitectureIr` (`ariadne-common`, incluye reflow del grid tras ensanchar componentes). Tras `validate`, usa `deliver` si el CLI lo soporta; si no, cae a `render` (Archify v2.9 en Docker). `npm run build` en ingest ejecuta `prebuild` de `ariadne-common`.

## Export / chat / parity

- `GET /projects/:id/c4/export` — 6 markdowns + `merged`
- `POST /internal/projects/:id/architecture-diagram` — respuesta chat
- Brownfield parity pack incluye `c4ContainerHtmlUrl`, `c4ContextHtmlUrl`, `c4ModelJson`

Ver [PLAN_C4_ARCHIFY.md](../../../docs/notebooklm/PLAN_C4_ARCHIFY.md).
