---
id: ingest-y-sharding
title: Ingest y sharding Falkor
category: Arquitectura
last_updated: 2026-06-29
---

# Ingest y sharding Falkor

> **AI Context Brief:** Cómo Ariadne indexa repos (servicio ingest) y cómo el grafo se divide por proyecto (sharding); léelo para entender `projectId` vs repo y por qué algunas tools exigen `projectId` explícito.

## 1. Uso Básico (Quick Start)

```typescript
// Proyecto (Ariadne) vs repo (root):
//   list_known_projects() -> [{ id, name, roots: [{ id, name, branch? }] }]
//   id          = UUID de proyecto (multi-repo)
//   roots[].id  = UUID de repo
// Pasa cualquiera como projectId; el MCP resuelve proyecto↔repo según el endpoint.

// Sharding por proyecto (FALKOR_SHARD_BY_PROJECT=true):
//   grafo = AriadneSpecs:<uuid>   (en vez de un único AriadneSpecs)
//   semantic_search y find_similar_implementations exigen projectId explícito.
```

## 2. API & Contrato de Tipos (Specs)

| Concepto                  | Detalle                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| `services/ingest` (3002)  | Sync Bitbucket/GitHub, webhook, `POST /shadow`, dominios, `GET /projects/:id/graph-routing`. NestJS + TypeORM + PostgreSQL. |
| Proyecto vs repo          | `projectId` puede ser ID de proyecto o `roots[].id` de repo.                  |
| `FALKOR_SHARD_BY_PROJECT` | Un grafo Redis/Falkor por `projectId` (`AriadneSpecs:<uuid>`).                |
| Inferencia sin `projectId`| Con `INGEST_URL`, el MCP prueba shards vía `GET /projects` + `/repositories`. |
| `:MarkdownDoc`            | El ingest crea nodos de docs (README/docs) de los repos sincronizados.        |
| `cypherShardContexts`     | `graph-routing` aporta whitelist de dominios + `cypherProjectId` por shard.   |

**Endpoints que el MCP usa contra ingest:** `…/file` (repositories/projects), `…/chat`, `…/modification-plan`, `…/analyze`, `…/sync-status`, `…/mdd-evidence` (interno, `X-Internal-API-Key`).

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** Con sharding activo, **siempre** pasa `projectId` a `semantic_search`/`find_similar_implementations`; no infiere desde la ruta del IDE.
- **Regla 2:** En multi-root, usa `roots[].id` como `projectId` (no el UUID del proyecto) o pasa `currentFilePath` para que el server resuelva el root.
- **Regla 3:** Los nodos del grafo llevan la propiedad `projectId` del índice usado en sync; usa el mismo UUID que `.ariadne-project` o `list_known_projects`.
- **Regla 4:** El `:MarkdownDoc` indexado es **documentación de repos cliente**, distinta de la documentación del propio Ariadne servida por `mcp-docs`.
