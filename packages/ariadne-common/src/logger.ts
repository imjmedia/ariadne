/**
 * @fileoverview Logger estructurado compartido (Pino) para todos los servicios Ariadne.
 * Cada servicio crea un logger con su nombre. Soporta correlation IDs vía `child({ requestId })`.
 * Nivel configurable via `LOG_LEVEL` (default: `info`).
 *
 * @module ariadne-common/logger
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import pino from 'pino';

const DEFAULT_LEVEL = 'info';

/**
 * Crea un logger Pino con el nombre del servicio.
 * El nivel se lee de `process.env.LOG_LEVEL` (fallback: `info`).
 *
 * @param service — Nombre del servicio (e.g. `api`, `ingest`, `orchestrator`, `mcp-ariadne`)
 */
export function createLogger(service: string): pino.Logger {
  const level = (process.env.LOG_LEVEL ?? DEFAULT_LEVEL).trim().toLowerCase();
  // Validar nivel contra Pino
  const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
  const effectiveLevel = validLevels.includes(level) ? level : DEFAULT_LEVEL;

  return pino({
    name: service,
    level: effectiveLevel,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    // Pretty-print en desarrollo si NO hay LOG_FORMAT=json y si stdout es TTY
    ...((!process.env.LOG_FORMAT || process.env.LOG_FORMAT === 'pretty') && process.stdout.isTTY
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
              ignore: 'name,pid,hostname',
            },
          },
        }
      : {}),
  });
}

/**
 * Helper: extrae o genera un correlation ID desde headers HTTP.
 * Busca `X-Request-Id`, `X-Correlation-Id` o `X-Trace-Id` (en ese orden).
 * Si ninguno existe, genera un UUIDv4 simple.
 *
 * @param headers — Objeto de headers (p. ej. `req.headers`)
 * @returns El correlation ID a propagar
 */
export function extractRequestId(headers: Record<string, string | string[] | undefined>): string {
  const candidate =
    (headers as Record<string, string | undefined>)['x-request-id'] ??
    (headers as Record<string, string | undefined>)['x-correlation-id'] ??
    (headers as Record<string, string | undefined>)['x-trace-id'];
  if (candidate && typeof candidate === 'string' && candidate.trim()) return candidate.trim();

  // UUID v4 simple sin dependencias
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
