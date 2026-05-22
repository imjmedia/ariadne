# ProjectDetail

- **`ProjectDetail.tsx`** — Vista del proyecto: pestañas **General** (repos, roles, sync, **selector de dominio** FK `projects.domain_id`) y **Arquitectura** (mismo selector + whitelist `project → dominio`, C4). **Resync (proyecto)** encola `resync-for-project` para todos los repos. **Quitar** desasocia el repo del proyecto (`DELETE /projects/:id/repositories/:repoId`) sin borrarlo en `/repositorios`.
- **`ArchitecturePanel.tsx`** — Dominio del proyecto, dependencias `project → dominio`, y `C4Previewer` (Kroki).
