# Configuración del sistema (`system_settings`)

Singleton admin en Postgres (`id='default'`) para valores operativos que antes vivían en `.env`.

## API

| Método | Ruta | Rol |
|--------|------|-----|
| GET | `/system-settings` | admin — valores enmascarados |
| PUT | `/system-settings` | admin — guardar |
| GET | `/internal/system-settings` | red interna — runtime completo (secretos) |

Resolución: **BD → env → defaults** (`system-settings.defaults.ts`).

## Secciones UI (`/settings/system`)

- Autenticación y correo: `EMAIL_OTP`, SMTP, `SSO_URL`, `WEB_APP_HOST`
- Red / Falkor: `CORS_ORIGIN`, sharding, soft limit, debug Cypher
- Observabilidad / chat: métricas, telemetría, two-phase, modification plan
- Integraciones: GitHub token (cifrado), Ollama embeddings

## Variables que permanecen en env

Bootstrap e infraestructura: `PG*`, `REDIS_URL`, `FALKORDB_*`, `INGEST_URL`, `JWT_*`, `CREDENTIALS_ENCRYPTION_KEY`, `OTP_DEV_MODE`, `VITE_*`, topología Docker.

Tras guardar, API e ingest refrescan caché (~15s). **CORS y métricas Prometheus** pueden requerir reinicio de `api` / `ingest`.
