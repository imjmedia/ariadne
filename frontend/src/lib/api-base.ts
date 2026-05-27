/**
 * Base URL para fetch al backend.
 *
 * - Producción / dev recomendado: `VITE_API_URL=http://localhost:3000` (Nest API) → `${origin}/api/...`
 *   Dokploy: mismo host, Traefik enruta `/api` → contenedor `api`.
 * - Ingest directo (solo MCP / depuración): `VITE_API_PATH_PREFIX=` vacío y URL `:3002`
 *   (las rutas auth OTP siguen en :3000 — no uses ingest directo para la UI completa).
 */
export function getApiBase(): string {
  const origin = (
    (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000'
  ).replace(/\/$/, '');

  const rawPrefix = import.meta.env.VITE_API_PATH_PREFIX as string | undefined;
  if (rawPrefix === '' || rawPrefix === 'none' || rawPrefix === 'off') {
    return origin;
  }

  // Ingest expuesto en :3002 sin Nest: rutas en /projects, no /api/projects
  if (rawPrefix === undefined && /:3002$/.test(origin)) {
    return origin;
  }

  const prefix = rawPrefix ?? '/api';
  if (prefix === '/') return origin;
  return origin + (prefix.startsWith('/') ? prefix : `/${prefix}`);
}
