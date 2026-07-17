# MDD persistence

Persiste JSON MDD 7§ tras full sync (`repository_mdd_snapshots`).

- **API:** `GET /repositories/:id/mdd/latest`
- **Hook:** `SyncService` post-sync si `auto_mdd_on_full_sync` o `theforge_project_id`
- **Env:** `AUTO_MDD_ON_FULL_SYNC=1` fuerza persistencia global
