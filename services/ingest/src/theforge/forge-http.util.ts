/**
 * Shared HTTP helper for The Forge integration API (`/theforge/*`).
 */
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { TheForgeIntegrationEffective } from './theforge-integration.types';

const logger = new Logger('TheForgeHttp');

/** REST base for service JWT. MCP Streamable HTTP lives at …/mcp (POST only). */
export function normalizeForgeApiBase(apiUrl: string): string {
  const trimmed = apiUrl.trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  if (trimmed.endsWith('/mcp')) {
    const root = trimmed.slice(0, -'/mcp'.length).replace(/\/$/, '');
    return `${root}/api`;
  }
  return trimmed;
}

export async function forgeIntegrationFetch(
  cfg: TheForgeIntegrationEffective,
  path: string,
  init: RequestInit,
): Promise<Response> {
  if (!cfg.enabled || !cfg.apiUrl) {
    throw new ServiceUnavailableException({
      code: 'FORGE_NOT_CONFIGURED',
      message: 'The Forge no está configurado. Actívalo en Ajustes (admin).',
    });
  }
  const token = cfg.serviceToken?.trim();
  if (!token) {
    throw new ServiceUnavailableException({
      code: 'FORGE_NO_SERVICE_TOKEN',
      message: 'Falta JWT de servicio The Forge (Ajustes o THEFORGE_SERVICE_JWT).',
    });
  }

  const base = normalizeForgeApiBase(cfg.apiUrl);
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

export async function readForgeJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    logger.warn(`Forge API non-JSON body (${res.status}): ${text.slice(0, 200)}`);
    return { message: text };
  }
}

export function forgeErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>;
    if (typeof rec.message === 'string') return rec.message;
    if (Array.isArray(rec.message)) return rec.message.join('; ');
  }
  return fallback;
}
