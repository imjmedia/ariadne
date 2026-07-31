# Docker — builds de producción (Dokploy / Compose)

## Arquitectura de deploy (GHCR + pull)

1. **GitHub Actions** (`.github/workflows/build-images.yml`) construye en CI y publica en `ghcr.io/kreodevs/ariadne-*`.
2. **Dokploy** hace `pull` + `up --no-build` usando `docker-compose.yml` + `docker-compose.prod.yml`.
3. El VPS **no compila** en el camino feliz (~2–5 min por deploy).

Imágenes publicadas:

| Servicio | Imagen |
|----------|--------|
| ariadne-common (base) | `ghcr.io/kreodevs/ariadne-common:<sha\|latest>` |
| mcp-export (tarball frontend) | `ghcr.io/kreodevs/ariadne-mcp-export:<sha\|latest>` |
| frontend, api, ingest, … | `ghcr.io/kreodevs/ariadne-<servicio>:<sha\|latest>` |

## Optimizaciones en Dockerfiles

BuildKit (`# syntax=docker/dockerfile:1.4`):

- Capas por dependencias (`package.json` / lockfile antes que `src`)
- `--mount=type=cache` para npm/pnpm
- **`ariadne-common` una sola vez** en CI (`docker/Dockerfile.ariadne-common`); servicios usan `ARG ARIADNE_COMMON_IMAGE`
- Frontend reutiliza tarball MCP vía `ARG MCP_EXPORT_IMAGE` (target `mcp-export` en `services/mcp-ariadne/Dockerfile`)
- `mcp-docs` en perfil Compose `docs` (no arranca en prod por defecto)

Requisito: `DOCKER_BUILDKIT=1` (default en Docker 23+).

## Dokploy — comando de deploy

```bash
export COMPOSE_PARALLEL_LIMIT=${COMPOSE_PARALLEL_LIMIT:-3}
docker compose -p apps-grupowib-relic-wbaqzm \
  -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -p apps-grupowib-relic-wbaqzm \
  -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans --no-build
```

Variables en Environment:

```env
COMPOSE_PARALLEL_LIMIT=3
IMAGE_TAG=latest
VITE_API_URL=https://relicai.obp.mx
```

**GHCR privado:** en el servidor Dokploy, configurar login a `ghcr.io` (PAT con `read:packages`).

**Primer deploy tras merge:** esperar a que termine el workflow *Build & push images* antes del redeploy en Dokploy.

## Fallback — build en el VPS

Si GHCR no tiene imagen aún:

```bash
export COMPOSE_PARALLEL_LIMIT=3
docker compose -f docker-compose.yml build --parallel
docker compose -f docker-compose.yml up -d --remove-orphans
```

## Build manual local

```bash
# Base compartida
docker build -f docker/Dockerfile.ariadne-common -t ariadne-common:local .

# Servicio con base pre-construida
docker build -f services/api/Dockerfile \
  --build-arg ARIADNE_COMMON_IMAGE=ariadne-common:local .

# Frontend (con export MCP local o pre-publicado)
docker build -f services/mcp-ariadne/Dockerfile --target mcp-export -t ariadne-mcp-export:local .
docker build -f frontend/Dockerfile \
  --build-arg MCP_EXPORT_IMAGE=ariadne-mcp-export:local \
  --build-arg VITE_API_URL=https://tu-dominio .
```

Ver también `docker-compose.yml`, `docker-compose.prod.yml` y `docs/notebooklm/DEPLOYMENT_DOKPLOY.md`.
