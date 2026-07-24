/**
 * Shared HTTP helper for The Forge integration API (`/theforge/*`).
 */
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { TheForgeIntegrationEffective } from './theforge-integration.types';

const logger = new Logger('TheForgeHttp');

export function isLikelyHtmlBody(text: string): boolean {
  const head = text.trim().slice(0, 120).toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.includes('<html');
}

/** Bases to try when THEFORGE_API_URL points at SPA root or /mcp instead of Nest API. */
export function collectForgeApiBaseCandidates(apiUrl: string): string[] {
  const raw = apiUrl.trim().replace(/\/$/, '');
  if (!raw) return [];
  const out: string[] = [];
  const add = (candidate: string) => {
    const normalized = candidate.replace(/\/$/, '');
    if (normalized && !out.includes(normalized)) out.push(normalized);
  };
  add(raw);
  if (raw.endsWith('/mcp')) {
    const withoutMcp = raw.slice(0, -'/mcp'.length).replace(/\/$/, '');
    add(withoutMcp);
    add(`${withoutMcp}/api`);
  } else if (!raw.endsWith('/api')) {
    add(`${raw}/api`);
  }
  return out;
}

export function suggestForgeApiUrl(apiUrl: string): string {
  const candidates = collectForgeApiBaseCandidates(apiUrl);
  return candidates.find((c) => c.endsWith('/api')) ?? candidates[candidates.length - 1] ?? apiUrl;
}

export async function forgeIntegrationFetch(
  cfg: TheForgeIntegrationEffective,
  path: string,
  init: RequestInit,
  options?: { apiBase?: string },
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

  const base = (options?.apiBase ?? cfg.apiUrl).replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export async function readForgeResponseBody(
  res: Response,
): Promise<{ body: unknown; rawText: string; isHtml: boolean }> {
  const rawText = await res.text();
  if (!rawText.trim()) {
    return { body: {}, rawText, isHtml: false };
  }
  if (isLikelyHtmlBody(rawText)) {
    logger.warn(`Forge API HTML body (${res.status}): ${rawText.slice(0, 200)}`);
    return { body: { message: rawText }, rawText, isHtml: true };
  }
  try {
    return { body: JSON.parse(rawText) as unknown, rawText, isHtml: false };
  } catch {
    logger.warn(`Forge API non-JSON body (${res.status}): ${rawText.slice(0, 200)}`);
    return { body: { message: rawText }, rawText, isHtml: false };
  }
}

export async function readForgeJsonBody(res: Response): Promise<unknown> {
  const { body } = await readForgeResponseBody(res);
  return body;
}

export function forgeErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>;
    if (typeof rec.message === 'string') return rec.message;
    if (Array.isArray(rec.message)) return rec.message.join('; ');
  }
  return fallback;
}

export function forgeHtmlApiUrlError(configuredUrl: string): ServiceUnavailableException {
  const suggested = suggestForgeApiUrl(configuredUrl);
  return new ServiceUnavailableException({
    code: 'FORGE_WRONG_API_URL',
    message:
      'THEFORGE_API_URL devuelve HTML (frontend SPA o endpoint /mcp), no JSON de la API REST de The Forge. Configura la base del backend Nest (p. ej. …/api), no la URL del MCP ni la raíz del sitio.',
    configuredApiUrl: configuredUrl,
    suggestedApiUrl: suggested === configuredUrl ? `${configuredUrl.replace(/\/$/, '')}/api` : suggested,
  });
}
