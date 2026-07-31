#!/bin/sh
# Build optimizado para Dokploy/VPS — sin registry externo.
# Compila ariadne-common y mcp-export una sola vez; el resto de servicios reutiliza esas capas.
set -e

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-3}"
PROJECT="${COMPOSE_PROJECT_NAME:-apps-grupowib-relic-wbaqzm}"

echo "==> ariadne-common (base compartida)"
docker build -f docker/Dockerfile.ariadne-common -t ariadne-common:local .

echo "==> mcp-export (tarball para frontend)"
docker build -f services/mcp-ariadne/Dockerfile \
  --target mcp-export \
  --build-arg ARIADNE_COMMON_IMAGE=ariadne-common:local \
  -t ariadne-mcp-export:local .

export ARIADNE_COMMON_IMAGE=ariadne-common:local
export MCP_EXPORT_IMAGE=ariadne-mcp-export:local

echo "==> servicios (paralelo limit=${COMPOSE_PARALLEL_LIMIT})"
docker compose -p "$PROJECT" -f docker-compose.yml build --parallel

echo "==> up"
docker compose -p "$PROJECT" -f docker-compose.yml up -d --remove-orphans
