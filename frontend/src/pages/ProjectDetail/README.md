# ProjectDetail

- **`ProjectDetail.tsx`** — Vista del proyecto: pestañas **General** (repos, roles, sync, **selector de dominio** FK `projects.domain_id`) y **Arquitectura** (mismo selector + whitelist `project → dominio`). **Resync (proyecto)** encola `resync-for-project` para todos los repos. **Quitar** desasocia el repo del proyecto (`DELETE /projects/:id/repositories/:repoId`) sin borrarlo en `/repositorios`.
- **`ArchitecturePanel.tsx`** — Dominio del proyecto y dependencias `project → dominio` (whitelist shards).
