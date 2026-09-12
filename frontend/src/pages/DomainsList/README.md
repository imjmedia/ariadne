# DomainsList

- **`DomainsList.tsx`** — Lista de dominios con recuento de proyectos (`assignedProjectCount` desde `GET /domains`), modal para ver proyectos asignados (`GET /domains/:id/projects`), y modal para aristas de visibilidad dominio→dominio (`GET|POST|DELETE /domains/:id/visibility`) usadas por `getCypherShardContexts`.
- **Alta de dominio** — Captura libre (nombre legible, color, descripción). El **catálogo** se precarga en backend con bounded contexts iniciales (Plataforma, CRM, Pagos, etc.) vía `GET /domains`. Los proyectos asignan dominio con un **select** en `ProjectDetail` / pestaña Arquitectura.
