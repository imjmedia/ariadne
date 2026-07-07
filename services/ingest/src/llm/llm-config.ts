/**
 * LLM (OpenRouter compatible) — misma convención que The Forge.
 * Prioridad: activeLlmConfig (BD vía Ajustes) → process.env (fallback).
 */
import { getActiveLlmConfig } from '../llm-settings/active-llm-config';

export const LLM_DEFAULT_BASE = 'https://openrouter.ai/api/v1';
export const LLM_DEFAULT_CHAT_MODEL = 'google/gemini-2.0-flash-001';
export const LLM_DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small';

export function resolveLlmApiKey(): string {
  const active = getActiveLlmConfig();
  if (active?.apiKey) return active.apiKey;
  return process.env.LLM_API_KEY?.trim() ?? '';
}

export function resolveLlmBaseUrl(): string {
  const active = getActiveLlmConfig();
  if (active?.baseUrl) return active.baseUrl;
  return process.env.LLM_BASE_URL?.trim() || LLM_DEFAULT_BASE;
}

export function llmDefaultHeaders(): Record<string, string> | undefined {
  const active = getActiveLlmConfig();
  const referer = active?.httpReferer ?? process.env.LLM_HTTP_REFERER?.trim();
  const title = active?.appTitle ?? process.env.LLM_APP_TITLE?.trim();
  if (!referer && !title) return undefined;
  return {
    ...(referer ? { 'HTTP-Referer': referer } : {}),
    ...(title ? { 'X-OpenRouter-Title': title } : {}),
  };
}

export function resolveLlmChatModel(): string {
  const active = getActiveLlmConfig();
  if (active?.chatModel) return active.chatModel;
  return (
    process.env.LLM_MODEL_INGEST?.trim() ||
    process.env.LLM_CHAT_MODEL?.trim() ||
    LLM_DEFAULT_CHAT_MODEL
  );
}

export function resolveLlmEmbeddingModel(): string {
  const active = getActiveLlmConfig();
  if (active?.embeddingModel) return active.embeddingModel;
  return process.env.LLM_EMBEDDING_MODEL?.trim() || LLM_DEFAULT_EMBEDDING_MODEL;
}

export function defaultEmbeddingDimension(): number {
  const active = getActiveLlmConfig();
  if (active?.embeddingDimension) return active.embeddingDimension;
  const raw = process.env.LLM_EMBEDDING_DIM?.trim();
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 1) return n;
  return 1536;
}

export function resolveLlmTemperature(): number {
  const active = getActiveLlmConfig();
  if (active?.temperature !== undefined && Number.isFinite(active.temperature)) {
    return active.temperature;
  }
  const n = parseFloat(process.env.LLM_TEMPERATURE || '0.1');
  return Number.isFinite(n) ? n : 0.1;
}
