/**
 * Lightweight Streamable HTTP MCP client for The Forge integration.
 * @see docs/notebooklm/MCP_HTTPS.md
 */
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { TheForgeIntegrationEffective } from './theforge-integration.types';

const logger = new Logger('TheForgeMcp');

export function isForgeMcpEndpointUrl(url: string): boolean {
  return url.trim().replace(/\/$/, '').endsWith('/mcp');
}

export function normalizeForgeMcpUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  if (trimmed.endsWith('/mcp')) return trimmed;
  return `${trimmed}/mcp`;
}

interface McpJsonRpcResponse {
  jsonrpc?: string;
  id?: number | string;
  result?: {
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  };
  error?: { code?: number; message?: string; data?: unknown };
}

export function extractMcpToolText(response: McpJsonRpcResponse): string {
  const content = response.result?.content ?? [];
  const textBlock = content.find((c) => c.type === 'text' && typeof c.text === 'string');
  return textBlock?.text?.trim() ?? '';
}

export function parseMcpToolJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim()) as unknown;
      } catch {
        return text;
      }
    }
    return text;
  }
}

export function parseMcpHttpBody(rawText: string, contentType: string): McpJsonRpcResponse {
  const ct = contentType.toLowerCase();
  if (ct.includes('text/event-stream')) {
    for (const line of rawText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        return JSON.parse(payload) as McpJsonRpcResponse;
      } catch {
        continue;
      }
    }
    throw new ServiceUnavailableException({
      code: 'FORGE_MCP_PARSE_FAILED',
      message: 'The Forge MCP devolvió SSE sin JSON-RPC parseable.',
    });
  }

  try {
    return JSON.parse(rawText) as McpJsonRpcResponse;
  } catch {
    throw new ServiceUnavailableException({
      code: 'FORGE_MCP_PARSE_FAILED',
      message: 'The Forge MCP devolvió una respuesta no JSON.',
    });
  }
}

export async function forgeMcpCallTool(
  cfg: TheForgeIntegrationEffective,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (cfg.transport !== 'mcp' || !cfg.mcpUrl) {
    throw new ServiceUnavailableException({
      code: 'FORGE_MCP_NOT_CONFIGURED',
      message: 'Integración MCP de The Forge no configurada.',
    });
  }

  const token = cfg.serviceToken?.trim();
  if (!token) {
    throw new ServiceUnavailableException({
      code: 'FORGE_NO_SERVICE_TOKEN',
      message: 'Falta token MCP/JWT de The Forge (Ajustes o THEFORGE_SERVICE_JWT).',
    });
  }

  const res = await fetch(cfg.mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-03-26',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    logger.warn(`Forge MCP ${toolName} → HTTP ${res.status}: ${rawText.slice(0, 300)}`);
    throw new ServiceUnavailableException({
      code: res.status === 401 ? 'FORGE_MCP_UNAUTHORIZED' : 'FORGE_MCP_HTTP_FAILED',
      message:
        res.status === 401
          ? 'Token rechazado por The Forge MCP. Usa el Secret MCP o JWT válido para /mcp (no el JWT REST de servicio).'
          : `The Forge MCP respondió HTTP ${res.status}.`,
      status: res.status,
      tool: toolName,
    });
  }

  const rpc = parseMcpHttpBody(rawText, res.headers.get('content-type') ?? 'application/json');
  if (rpc.error) {
    throw new ServiceUnavailableException({
      code: 'FORGE_MCP_RPC_ERROR',
      message: rpc.error.message ?? `Error MCP al invocar ${toolName}`,
      tool: toolName,
    });
  }

  const text = extractMcpToolText(rpc);
  if (rpc.result?.isError) {
    throw new ServiceUnavailableException({
      code: 'FORGE_MCP_TOOL_ERROR',
      message: text || `The Forge MCP tool ${toolName} falló.`,
      tool: toolName,
    });
  }

  return parseMcpToolJson(text);
}

export async function forgeMcpCallToolJson<T = unknown>(
  cfg: TheForgeIntegrationEffective,
  toolName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const data = await forgeMcpCallTool(cfg, toolName, args);
  return data as T;
}
