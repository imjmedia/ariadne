# Credentials — Credenciales cifradas en BD

Las credenciales (tokens Bitbucket/GitHub, app passwords, webhook secrets) se guardan cifradas en PostgreSQL con AES-256-GCM.

## Requisito

`CREDENTIALS_ENCRYPTION_KEY`: clave de 32 bytes (base64 o hex). Generar con:

```bash
openssl rand -base64 32
```

## API

- `GET /credentials?provider=bitbucket` — Lista credenciales (sin valor)
- `GET /credentials/:id` — Detalle (sin valor)
- `POST /credentials` — Crear: `{ provider, kind, value, name?, extra? }`
- `DELETE /credentials/:id` — Eliminar

## Tipos (kind)

- `token` — OAuth/PAT. Bitbucket API tokens requieren `extra.email` (Atlassian account email) para Basic auth
- `app_password` — Bitbucket App Password (`extra.username` requerido). Permisos: Account: Read, Workspace membership: Read, Repositories: Read (ver docs/manual/CONFIGURACION_Y_USO.md)
- `webhook_secret` — Secret para webhook Bitbucket (HMAC-SHA256)

## Alcance por usuario

Cada credencial de tipo `token` / `app_password` se guarda con `user_id` (cabeceras `X-User-Id` / `X-User-Role` desde el proxy API). El listado solo muestra las del usuario; admin ve todas.

## Uso en sync

Al encolar sync desde la UI (`POST /repositories/:id/sync`), se usa la credencial del usuario que dispara el job; si no tiene, `repositories.credentialsRef`; si no, variables de entorno.

Al crear un repo puedes fijar `credentialsRef` explícito (p. ej. credencial compartida legada). Webhooks sin usuario siguen con `credentialsRef` del repo o env.
