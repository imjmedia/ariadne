# DomainsList

- **`DomainsList.tsx`** — Lista de dominios con recuento de proyectos (`assignedProjectCount` desde `GET /domains`), modal para ver proyectos asignados (`GET /domains/:id/projects`), y modal para aristas de visibilidad dominio→dominio (`GET|POST|DELETE /domains/:id/visibility`) usadas por `getCypherShardContexts`.
- **Alta de dominio** — Select con bounded contexts prepoblados (Plataforma, CRM, Pagos, etc.) más opción **Personalizado** para motores o microservicios con nombre propio (p. ej. Motor de costos, Listas de precios, Media Manager). No es dominio web; al elegir preset se rellenan descripción y color sugeridos. Los presets ya creados se ocultan del select.
