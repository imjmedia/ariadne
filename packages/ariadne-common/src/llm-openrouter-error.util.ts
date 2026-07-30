/**
 * Errores tipados de OpenRouter / OpenAI-compatible chat completions.
 */

export class LlmContextLengthError extends Error {
  override readonly name = 'LlmContextLengthError';

  constructor(
    message: string,
    readonly model: string,
    readonly maxContextTokens: number | null,
    readonly requestedTokens: number | null,
    readonly providerMessage: string,
  ) {
    super(message);
  }
}

export function isLlmContextLengthError(err: unknown): err is LlmContextLengthError {
  return err instanceof LlmContextLengthError;
}

function parseTokenCount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw.replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function extractOpenRouterProviderMessage(bodyText: string): string {
  const trimmed = bodyText.trim();
  if (!trimmed) return bodyText;
  try {
    const json = JSON.parse(trimmed) as { error?: { message?: string } };
    if (json.error?.message?.trim()) return json.error.message.trim();
  } catch {
    /* plain text */
  }
  return trimmed;
}

export function parseContextLengthFromMessage(providerMessage: string): {
  maxContextTokens: number | null;
  requestedTokens: number | null;
} {
  const maxMatch = providerMessage.match(/maximum context length is ([\d,]+)/i);
  const requestedMatch = providerMessage.match(/requested about ([\d,]+) tokens/i);
  return {
    maxContextTokens: parseTokenCount(maxMatch?.[1]),
    requestedTokens: parseTokenCount(requestedMatch?.[1]),
  };
}

export function isContextLengthProviderMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('maximum context length') ||
    lower.includes('context_length_exceeded') ||
    (lower.includes('context length') && lower.includes('token')) ||
    (lower.includes('reduce the length') && lower.includes('token'))
  );
}

export function buildLlmContextLengthMessage(
  model: string,
  maxContextTokens: number | null,
  requestedTokens: number | null,
): string {
  const parts = [
    `El modelo «${model}» no tiene ventana de contexto suficiente para esta consulta.`,
  ];
  if (requestedTokens != null && maxContextTokens != null) {
    parts.push(
      `Se solicitaron ~${requestedTokens.toLocaleString('en-US')} tokens y el límite del endpoint es ~${maxContextTokens.toLocaleString('en-US')}.`,
    );
  } else if (maxContextTokens != null) {
    parts.push(`Límite del endpoint: ~${maxContextTokens.toLocaleString('en-US')} tokens.`);
  }
  parts.push(
    'Usa un modelo con ventana mayor en Ajustes → Proveedores IA (modelo worker/router del orchestrator) o reduce el alcance: un solo repo, prefijos de path, o menos historial en el chat.',
  );
  return parts.join(' ');
}

/**
 * Mapea respuestas HTTP del proveedor LLM a errores tipados (context length, etc.).
 * Devuelve null si no hay mapeo específico.
 */
export function mapOpenRouterHttpError(status: number, bodyText: string, model: string): Error | null {
  const providerMessage = extractOpenRouterProviderMessage(bodyText);
  if (
    status === 413 ||
    (status === 400 && isContextLengthProviderMessage(providerMessage))
  ) {
    const { maxContextTokens, requestedTokens } = parseContextLengthFromMessage(providerMessage);
    return new LlmContextLengthError(
      buildLlmContextLengthMessage(model, maxContextTokens, requestedTokens),
      model,
      maxContextTokens,
      requestedTokens,
      providerMessage,
    );
  }
  return null;
}
