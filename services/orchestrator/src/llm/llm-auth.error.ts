/**
 * Error explícito cuando el LLM devuelve 401/403 (API key inválida o sin permisos).
 */
export class LlmAuthError extends Error {
  override readonly name = 'LlmAuthError';
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function isLlmAuthError(err: unknown): err is LlmAuthError {
  return err instanceof LlmAuthError;
}
