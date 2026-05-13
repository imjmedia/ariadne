# Deployment en Dokploy — Ariadne

Despliegue del stack Ariadne con un solo dominio.

**Importante (ariadne-common):** Ingest, Cartographer y MCP dependen del paquete local `packages/ariadne-common`. Los Dockerfiles deben construirse **con contexto en la raíz del repo** (`context: .`), para que la imagen incluya y compile `ariadne-common`. El `docker-compose.yml` ya usa `context: .` en todos los servicios; no cambiar a un contexto por servicio. Ver [docs/ariadne-common.md](ariadne-common.md).
- **ariadne.kreoint.mx** — Frontend (SPA) + rutas API (/repositories, /graph/*, etc.) enrutadas internamente

## 1. Arquitectura de dominios (un solo dominio)

| Componente | Dominio | Rutas | Uso |
|------------|---------|-------|-----|
| Frontend | ariadne.kreoint.mx | `/`, `/repos/*`, `/credentials/*` | UI (SPA) |
| API (proxy interno) | ariadne.kreoint.mx | `/api/*` | Enruta a ingest; /api/graph/*, /api/openapi.json, /api/health |

**Un solo dominio** — El frontend hace peticiones a `ariadne.kreoint.mx/api/repositories` etc. Traefik enruta todo lo que empiece con `/api` al contenedor API (api:3000). Internamente la API reenvía al ingest.

## 2. Variables de entorno para producción

En **Dokploy** → tu aplicación → **Environment**, o en `.env` del proyecto:

```env
# CORS — permitir requests desde el frontend
CORS_ORIGIN=https://ariadne.kreoint.mx

# Build del frontend — mismo origen (las rutas API se enrutan internamente)
VITE_API_URL=https://ariadne.kreoint.mx

# Embeddings y credenciales (obligatorio)
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=<tu-key>
# Opcional — modelo para chat/analyze/modification-plan (default en compose: gpt-4o-mini)
LLM_CHAT_MODEL=gpt-4o-mini
CREDENTIALS_ENCRYPTION_KEY=<generar con: openssl rand -base64 32>

# MCP: cada desarrollador pone Bearer en ~/.cursor/mcp.json (Secret MCP `ari_…` en Perfil o JWT de sesión). No uses `ARIADNE_API_*` en Environment para eso.

# API Nest — firma JWT OTP/SSO (obligatorio en producción para la web)
JWT_SECRET=<openssl rand -base64 32>
```

El contenedor MCP recibe típicamente **`ARIADNE_API_URL=http://api:3000`** vía Compose; los **Bearer personales no van ahí.**

## 3. Enrutamiento Traefik (docker-compose)

Un solo dominio **ariadne.kreoint.mx** con enrutamiento por path:

- **ariadne.kreoint.mx/api** (todo lo que empiece con `/api`) → api:3000 (interno)
- **ariadne.kreoint.mx** (resto) → frontend:80 (SPA)

Requisitos:
- La red `dokploy-network` debe existir (Dokploy la crea automáticamente).
- Apuntar el registro A de ariadne.kreoint.mx al servidor.

## 4. Build del frontend para producción

El frontend debe compilarse con `VITE_API_URL=https://ariadne.kreoint.mx`:

```bash
cd frontend
VITE_API_URL=https://ariadne.kreoint.mx npm run build
```

O con docker-compose (leyendo del .env):

```bash
VITE_API_URL=https://ariadne.kreoint.mx docker compose build frontend
```

## 5. CORS

API e Ingest leen `CORS_ORIGIN` (orígenes separados por coma). Para producción:

```env
CORS_ORIGIN=https://ariadne.kreoint.mx
```

Si está vacío, se permite cualquier origen (adecuado para desarrollo).

## 6. MCP (Cursor)

### Opción A: MCP por URL (Streamable HTTP, sin túnel SSH)

El MCP usa **Streamable HTTP** en el puerto 8080. FalkorDB e Ingest están en la red interna. **No hace falta túnel SSH.**

1. **En Dokploy** (Domains / Rutas): añadir **dos rutas** para que Cursor funcione:
   - Path **`/mcp`** (o prefix `/mcp`) → servicio **mcp-ariadne**, puerto **8080** — conexión MCP
   - Path **`/.well-known`** (o prefix) → servicio **mcp-ariadne**, puerto **8080** — discovery OAuth (Cursor pide esto antes de conectar)
   - Orden: rutas más específicas primero. Sin esto, `/mcp` devuelve HTML (SPA) → error "Unexpected token '<'"
2. **Bearer por usuario**: en **Perfil** genera tu **Secret MCP** (`ari_…`). En Cursor (`mcp.json`) añade `headers.Authorization: Bearer <ari_…>` (o el **JWT de sesión** vigente tras login web). El proceso MCP valida vía ingest y reenvía el mismo Bearer al API Nest para grafos/C4 — **no** uses `ARIADNE_API_BEARER`/`ARIADNE_API_JWT` en Environment.
3. **Cursor** (`~/.cursor/mcp.json`) — ejemplo:

```json
{
  "mcpServers": {
    "ariadnespecs": {
      "url": "https://ariadne.kreoint.mx/mcp",
      "headers": {
        "Authorization": "Bearer <tu Secret MCP `ari_…` o JWT de sesión>"
      }
    }
  }
}
```

En **desarrollo** el compose puede activar `MCP_HTTP_ALLOW_UNAUTHENTICATED` (solo local; **no** en producción expuesta).


El MCP tiene `FALKORDB_HOST=falkordb`, `INGEST_URL=http://ingest:3002` y escucha en `0.0.0.0:8080`.

### Opción B: MCP local + túnel SSH

Si prefieres el MCP local (npx) con túnel SSH: ver [INSTALACION_MCP_CURSOR.md](INSTALACION_MCP_CURSOR.md) — Escenario C.

## 7. Postgres y migraciones

El servicio **ingest** ejecuta migraciones automáticamente al arrancar. No hace falta correr `migration:run` manualmente: al iniciar el contenedor, se crean/actualizan las tablas (`repositories`, `sync_jobs`, `indexed_files`, `credentials`) y luego arranca NestJS.

Variables requeridas para Postgres (ingest):

- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

## 8. Resumen de comprobaciones

- [ ] Postgres con variables `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` en ingest
- [ ] `CORS_ORIGIN=https://ariadne.kreoint.mx` en API e Ingest
- [ ] `VITE_API_URL=https://ariadne.kreoint.mx` al build del frontend
- [ ] Frontend desplegado en ariadne.kreoint.mx
- [ ] API accesible en ariadne.kreoint.mx/api/repositories, /api/graph/*, etc.
- [ ] Certificado SSL en ariadne.kreoint.mx
- [ ] Cursor con `headers.Authorization` (Secret MCP `ari_…` o JWT vigente); sin `ARIADNE_API_*` en Dokploy para eso
