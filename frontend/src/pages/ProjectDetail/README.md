# ProjectDetail

- **`ProjectDetail.tsx`** — Vista del proyecto: pestañas **General** (repos, roles, sync, **selector de dominio** FK `projects.domain_id`, **vinculación The Forge**) y **Arquitectura** (mismo selector + whitelist `project → dominio`). **Resync (proyecto)** encola `resync-for-project` para todos los repos. **Quitar** desasocia el repo del proyecto (`DELETE /projects/:id/repositories/:repoId`) sin borrarlo en `/repositorios`.
- **`ProjectTheForgeLinkSection.tsx`** — Si The Forge está activo en Ajustes: vincular/desvincular proyecto brownfield y botón **Crear etapa** (`POST /projects/:id/theforge-stage`).
- **`ProjectTheForgeStageDialog.tsx`** — Modal: descripción del cambio → preview de descripción del trabajo + documento `# Tasks` → crea etapa en Forge.
- **`ArchitecturePanel.tsx`** — Dominio del proyecto y dependencias `project → dominio` (whitelist shards).
