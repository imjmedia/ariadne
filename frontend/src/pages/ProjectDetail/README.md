# ProjectDetail

Vista de detalle de proyecto Ariadne.

## ArchitecturePanel

- **Dominios** — gobierno (`domainId`, whitelist).
- **Diagramas C4** — Context, Container, Component (`C4DiagramViewer`), secuencia API (`C4SequenceViewer`), evidencias (`C4EvidencePanel`), compare (`C4SnapshotCompare`), export `.md`.

API: `GET/POST /projects/:id/c4`, `GET .../c4/html`. Ver `services/ingest/src/c4/README.md`.
