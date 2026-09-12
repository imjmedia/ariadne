# ProjectDetail

Vista de detalle de proyecto Ariadne.

## ArchitecturePanel

- **Dominios** — gobierno (`domainId`, whitelist). Botón **Inferir desde índice** (`POST .../domain-dependencies/infer`) sugiere dependencias desde package.json, workspaces y compose si hay dominios coincidentes en catálogo.
- **Diagramas C4** — Context, Container, Component (`C4DiagramViewer`), secuencia API (`C4SequenceViewer`), evidencias (`C4EvidencePanel`), compare (`C4SnapshotCompare`), export `.md`. Si Archify falla, la UI muestra `archifyError` del ingest (CLI, validate, deliver).

API: `GET/POST /projects/:id/c4`, `GET .../c4/html`. Ver `services/ingest/src/c4/README.md`.
