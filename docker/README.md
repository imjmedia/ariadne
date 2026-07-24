# Docker — builds de producción (Dokploy / Compose)

## Optimizaciones de deploy

Los `Dockerfile` usan **BuildKit** (`# syntax=docker/dockerfile:1.4`) con:

- Capas por dependencias (`package.json` / lockfile antes que `src`)
- `--mount=type=cache` para npm/pnpm (no re-descarga en cada deploy)
- Frontend **sin** `COPY . .` ni `buildstamp` anti-caché
- Tarball MCP en stage aparte (solo se reconstruye si cambia `mcp-ariadne` o `ariadne-common`)

Requisito en el servidor: `DOCKER_BUILDKIT=1` (default en Docker 23+).

## Dokploy / VPS lentos

Si el deploy tarda mucho con `--build` en los 6 servicios:

1. **Variables de entorno del deploy:** `COMPOSE_PARALLEL_LIMIT=2` (menos contención CPU/disco)
2. Revisar disco lleno / swap (`docker system df`, ampliar SSD)
3. Tras merge, un deploy solo-backend no debe reconstruir capas de `pnpm install` del frontend

## Build manual

```bash
# Frontend (contexto raíz del repo)
docker build -f frontend/Dockerfile --build-arg VITE_API_URL=https://tu-dominio/api .

# Ingest
docker build -f services/ingest/Dockerfile .
```

Ver también `docker-compose.yml` y `README.md` (variables `VITE_*` como build args).
