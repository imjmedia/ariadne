# Páginas

Vistas principales de la aplicación Ariadne (shell SaaS: sidebar + header con breadcrumbs).

## Dashboard

- **Dashboard.tsx** — KPIs desde API: número de proyectos, repositorios, dominios y **salud de ingesta** (% repos en `ready`). Accesos rápidos a grafo y cola. Ruta: `/dashboard` (landing tras login; **`/` redirige aquí**).

## Proyectos (multi-root)

- **DomainsList.tsx** — CRUD de **dominios** (nombre, color, descripción), columna **Proyectos asignados** (recuento + diálogo con enlaces), y diálogo **Visibilidad entre dominios** (`domain_domain_visibility`). Los proyectos también asignan dominio en **ProjectDetail** (General o Arquitectura). Ruta: `/domains`.
- **ProjectList.tsx** — Lista de proyectos en **cards** con barra de salud de ingesta (repos `ready`/total), badge de dominio si aplica, ID MCP. Títulos de página `text-4xl`. Ruta **`/projects`** (no `/`; la raíz redirige al dashboard). Botón **Dominios** → `/domains`.
- **CreateProject.tsx** — Alta de proyecto (nombre y descripción opcionales). Tras crear redirige a `/projects/:id` donde se pueden añadir repos. Ruta: `/projects/new`.
- **ProjectDetail.tsx** — Detalle de proyecto: nombre, descripción (editable), ID (MCP) con copiar y botón **Regenerar ID** (crea nuevo UUID sin perder datos), tabla de repos (columna **Rol (chat)** editable, persiste vía API para inferencia multi-root), acciones por repo.
- **ProjectChat.tsx** — Chat a nivel proyecto (multi-repo). Mismo layout que RepoChat: panel Chats persistido + conversación. Ruta: `/projects/:id/chat`.

## Repositorios (The Forge)

- **RepoList.tsx** — Lista de repositorios con **DataTable** (TanStack: ordenación y filtro global). Título de vista **The Forge**. Acciones **Ver**, **Editar**, **Resync**, **Eliminar** (sin cambiar API).
- **ActiveJobsQueue.tsx** — Cola global: `queued` / `running` más jobs **terminados recientes** (`completed` / `failed`) para auditoría; desplegables **Ver indexados** / **Ver omitidos**; **Encolar sync** (`POST /repositories/:id/sync`) y **Resync** (`POST /repositories/:id/resync` con confirmación); **Cancelar** en jobs activos (`POST /repositories/:id/jobs/:jobId/cancel`: quita Bull/Redis y marca `failed` en Postgres); checkboxes + **Borrar seleccionados** / **Borrar** por fila (`DELETE /repositories/:id/jobs/:jobId`, también limpia Redis para ese `syncJobId`). Los jobs `running` siguen sin poder borrarse del historial con “Borrar”, pero sí **Cancelar**. `GET /repositories/jobs/active`; `SYNC_QUEUE_RECENT_JOBS` en ingest (default 100). Auto-refresh cada 5s. Ruta: `/jobs`.
- **RepoDetail.tsx** — Detalle de un repo (sync, jobs, análisis).
- **RepoChat.tsx** — Chat por repositorio. Panel **Chats** (historial por usuario) + conversación; análisis en sheet lateral; opciones en popover. Ruta: `/repos/:id/chat`.
- **RepoIndex.tsx** — Navegador del índice Falkor del repo (`GET graph-summary` con `full=1` y **`repoScoped=1`** para no mezclar nodos de otros roots en proyectos multi-root).
- **CreateRepo.tsx** — Alta de repo; acepta `?projectId=` para asociar al proyecto. Refactor: hook `useCreateRepoDiscovery` y componentes `CreateRepoProviderSelect`, `CreateRepoCredentialSelect` para reducir nesting.
- **EditRepo.tsx** — Edición de repo (credencial, branch, webhook) y **alcance del índice**: todo el repo o restringido (`path_prefix` / `file` vía `indexIncludeRules` en PATCH; en servidor columna `index_include_rules`).

## Otros

- **Login.tsx** — Autenticación OTP: email → código de 6 dígitos.
- **CredentialsList.tsx**, **CreateCredentialForm.tsx**, **EditCredential.tsx** — CRUD de credenciales (alta en modal con `?create=1`).
- **SettingsPage.tsx** — **Ajustes** (admin): configuración global LLM (proveedor, API key cifrada, modelos, embeddings, temperatura). API: `GET/PUT /api/llm-settings`, `POST /api/llm-settings/test`. Ruta: `/settings` (enlace en sidebar Plataforma).
- **Ayuda.tsx** — Manual y ayuda (docs).
- **ErrorPage.tsx** — Página de error genérica.
