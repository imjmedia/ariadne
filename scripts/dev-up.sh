#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Ariadne — Dev Up
# Arranca todos los servicios para desarrollo local.
# Uso: ./scripts/dev-up.sh [--build] [--detach]
# ─────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

BUILD=""
DETACH=""

for arg in "$@"; do
  case "$arg" in
    --build) BUILD="--build" ;;
    --detach|-d) DETACH="--detach" ;;
  esac
done

echo "🚀 Ariadne — Levantando servicios..."

# Verificar .env
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "⚠️  No hay .env. Copiando desde .env.example..."
    cp .env.example .env
    echo "   Edita .env con tus valores antes de continuar."
    echo "   Variables requeridas: LLM_API_KEY, JWT_SECRET, CREDENTIALS_ENCRYPTION_KEY"
  else
    echo "❌ No hay .env ni .env.example"
    exit 1
  fi
fi

# Build ariadne-common primero (lo necesitan varios servicios)
if [ ! -d packages/ariadne-common/dist ]; then
  echo "📦 Construyendo ariadne-common..."
  (cd packages/ariadne-common && npm install && npm run build)
fi

echo "🐳 Levantando contenedores..."

# Servicios core: falkordb, postgres, redis
docker compose up -d falkordb postgres redis

echo "⏳ Esperando bases de datos..."
sleep 5

# Servicios de aplicación
docker compose up $DETACH $BUILD api ingest mcp-ariadne frontend

# Orquestador (opcional — lo requiere el chat avanzado)
if [ "${INCLUDE_ORCHESTRATOR:-}" = "1" ]; then
  docker compose up $DETACH $BUILD orchestrator
fi

echo ""
echo "✅ Ariadne corriendo:"
echo "   Frontend:  http://localhost"
echo "   API:       http://localhost:3000/api"
echo "   Ingest:    http://localhost:3002"
echo "   MCP:       http://localhost:8080/mcp"
if [ "${INCLUDE_ORCHESTRATOR:-}" = "1" ]; then
  echo "   Orchestrator: http://localhost:3001"
fi
echo ""
echo "📋 Logs: docker compose logs -f"
