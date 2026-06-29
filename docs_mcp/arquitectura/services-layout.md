---
id: services-layout
title: Layout de servicios Ariadne
category: Arquitectura
last_updated: 2026-06-29
---

# Layout de servicios Ariadne

> **AI Context Brief:** Mapa de microservicios del monorepo Ariadne (api, ingest, orchestrator, MCPs, cartographer); léelo para ubicar dónde vive cada capacidad antes de proponer cambios.

## 1. Uso Básico (Quick Start)

```bash
# Desde la raíz del repo (pnpm manual, sin workspaces.yaml):
pnpm run build:back          # compila api, ingest, orchestrator, mcp-ariadne, mcp-docs, cartographer
pnpm run docker:up           # infra + servicios (docker-compose)

# Solo infra local:
docker-compose up -d falkordb postgres redis
```

## 2. API & Contrato de Tipos (Specs)

| Servicio        | Puerto | Rol                                                                 |
| --------------- | ------ | ------------------------------------------------------------------- |
| `frontend/`     | 5173   | UI admin React + Vite (repos, sync, jobs).                          |
| `services/api`  | 3000   | API REST NestJS: `/graph/*`, proxy a ingest.                        |
| `services/ingest` | 3002 | Sync Bitbucket/GitHub, webhook, shadow, dominios, PostgreSQL.     |
| `services/orchestrator` | 3001 | Orquestador NestJS + LangGraph.                             |
| `services/mcp-ariadne` | 8080 | MCP grafo FalkorDB (~30 tools).                              |
| `services/mcp-docs` | 8081 | MCP documentación estática (`docs_mcp/`).                       |
| `services/cartographer` | —  | Utilidades de cartografía del grafo.                          |
| `packages/ariadne-common` | — | Tipos/utilidades compartidas (ESM).                         |

**Infra Docker:** FalkorDB (6379), PostgreSQL (5432), Redis (6380 host).

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** No hay `pnpm-workspace.yaml`; el root `package.json` orquesta con `pnpm -C <path>`.
- **Regla 2:** Dependencias locales vía `file:../../packages/ariadne-common`.
- **Regla 3:** Dos servidores MCP complementarios: **grafo** (`mcp-ariadne`) vs **docs** (`mcp-docs`); no mezclar responsabilidades.
- **Regla 4:** Node >= 20 en todos los servicios; imágenes Docker `node:20-alpine`.
