# ProjectDetail

- **`ProjectDetail.tsx`** — Vista del proyecto: pestañas **General** y **Arquitectura**. Contenedor `max-w-7xl`. En **General**, layout responsive: cabecera compacta (nombre, ID MCP, acciones) y grid `lg:grid-cols-12` con **repositorios** en columna principal (`lg:col-span-8`) y sidebar (`lg:col-span-4`) con descripción, dominio y The Forge. **Resync (proyecto)** encola `resync-for-project` para todos los repos. **Quitar** desasocia el repo del proyecto (`DELETE /projects/:id/repositories/:repoId`) sin borrarlo en `/repositorios`.
- **`ProjectTheForgeLinkSection.tsx`** — Si The Forge está activo en Ajustes: vincular/desvincular proyecto brownfield y botón **Crear etapa** (`POST /projects/:id/theforge-stage`). Lista LEGACY vía REST The Forge (`GET /theforge-integration/brownfield-projects`), no MCP.
- **`ProjectTheForgeStageDialog.tsx`** — Modal: descripción del cambio → preview de descripción del trabajo + documento `# Tasks` → crea etapa en Forge.
- **`ArchitecturePanel.tsx`** — Dominio del proyecto y dependencias `project → dominio` (whitelist shards).
