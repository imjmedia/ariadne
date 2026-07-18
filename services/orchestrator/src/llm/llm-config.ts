/**
 * LLM (OpenRouter compatible). Alineado con ingest: `llm-config.ts` allí.
 * API key solo desde runtime cacheado de ingest (Ajustes en BD).
 */

import { getOrchestratorLlmRuntimeSync } from './llm-settings.client';

export const LLM_DEFAULT_BASE = 'https://openrouter.ai/api/v1';
export const LLM_DEFAULT_CHAT_MODEL = 'google/gemini-2.0-flash-001';

/** Clave LLM desde Ajustes (vía GET ingest /internal/llm-runtime). */
export function resolveLlmApiKey(): string {
  return getOrchestratorLlmRuntimeSync().apiKey?.trim() ?? '';
}

export function resolveLlmBaseUrl(): string {
  const rt = getOrchestratorLlmRuntimeSync();
  if (rt.baseUrl) return rt.baseUrl;
  return process.env.LLM_BASE_URL?.trim() || LLM_DEFAULT_BASE;
}

/** Cabeceras opcionales requeridas por OpenRouter en algunos despliegues. */
export function llmDefaultHeaders(): Record<string, string> | undefined {
  const rt = getOrchestratorLlmRuntimeSync();
  const referer = rt.httpReferer ?? process.env.LLM_HTTP_REFERER?.trim();
  const title = rt.appTitle ?? process.env.LLM_APP_TITLE?.trim();
  if (!referer && !title) return undefined;
  return {
    ...(referer ? { 'HTTP-Referer': referer } : {}),
    ...(title ? { 'X-OpenRouter-Title': title } : {}),
  };
}

export function resolveLlmTemperature(): number {
  const rt = getOrchestratorLlmRuntimeSync();
  if (Number.isFinite(rt.temperature)) return rt.temperature;
  const n = parseFloat(process.env.LLM_TEMPERATURE || '0.1');
  return Number.isFinite(n) ? n : 0.1;
}
