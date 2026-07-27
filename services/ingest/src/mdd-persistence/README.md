# MDD persistence

Persiste JSON MDD tras full sync (`repository_mdd_snapshots`).

- **API:** `GET /repositories/:id/mdd/latest`
- **Merge proyecto:** `POST /internal/projects/:projectId/mdd-evidence-merged` — fusiona snapshots (o live) de todos los roots + `multi_root`
- **Hook:** `SyncService` post-sync si `auto_mdd_on_full_sync` o `theforge_project_id`
- **Env:** `AUTO_MDD_ON_FULL_SYNC=1` fuerza persistencia global
- **Servicios:** `MddPersistenceService`, `MddProjectMergeService` (`mdd-project-merge.service.ts`)
