# Docker — builds de producción (Dokploy / Compose)

## Optimizaciones de deploy (build en el VPS)

Los `Dockerfile` usan **BuildKit** (`# syntax=docker/dockerfile:1.4`) con:

- Capas por dependencias (`package.json` / lockfile antes que `src`)
- `--mount=type=cache` para npm/pnpm (no re-descarga en cada deploy)
- **`ariadne-common` una sola vez** por deploy vía `docker/deploy-build.sh` (en lugar de 5 compilaciones)
- Frontend reutiliza tarball MCP vía `MCP_EXPORT_IMAGE` (target `mcp-export` en `services/mcp-ariadne/Dockerfile`)
- `mcp-docs` en perfil Compose `docs` (no arranca en prod por defecto)

Requisito en el servidor: `DOCKER_BUILDKIT=1` (default en Docker 23+).

## Dokploy — comando recomendado

```bash
COMPOSE_PROJECT_NAME=apps-grupowib-relic-wbaqzm sh docker/deploy-build.sh
```

Variable en Environment:

```env
COMPOSE_PARALLEL_LIMIT=3
COMPOSE_PROJECT_NAME=apps-grupowib-relic-wbaqzm
```

Ajustes en el servidor Dokploy (Settings → Server):

- **buildsConcurrency:** 2–3
- **Docker cleanup:** activado periódicamente
- **Isolated deployment:** activado (no reinicia FalkorDB/Postgres/Redis)
- **watchPaths:** paths del repo que disparan redeploy

## Tiempos esperados

| Escenario | Tiempo aprox. |
|-----------|---------------|
| Rebuild completo (sin caché) | 15–25 min |
| Solo cambió un servicio (caché Docker) | 3–8 min |
| Con `deploy-build.sh` (common 1×) | ~20–30 % menos que build naive |

## Build manual

```bash
# Script completo (recomendado)
COMPOSE_PROJECT_NAME=apps-grupowib-relic-wbaqzm sh docker/deploy-build.sh

# O paso a paso
docker build -f docker/Dockerfile.ariadne-common -t ariadne-common:local .
docker build -f services/mcp-ariadne/Dockerfile --target mcp-export \
  --build-arg ARIADNE_COMMON_IMAGE=ariadne-common:local -t ariadne-mcp-export:local .
export ARIADNE_COMMON_IMAGE=ariadne-common:local MCP_EXPORT_IMAGE=ariadne-mcp-export:local
docker compose -f docker-compose.yml build --parallel
docker compose -f docker-compose.yml up -d --remove-orphans
```

Ver también `docker-compose.yml` y `docs/notebooklm/DEPLOYMENT_DOKPLOY.md`.
