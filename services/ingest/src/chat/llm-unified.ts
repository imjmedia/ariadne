/**
 * Ingest: LLM vía activeLlmConfig (Ajustes) o LLM_PROVIDER env (openrouter por defecto).
 * @see ../llm/llm-config.ts
 */
import { getActiveLlmConfig } from '../llm-settings/active-llm-config';
import { resolveLlmApiKey, resolveLlmChatModel, LLM_DEFAULT_CHAT_MODEL } from '../llm/llm-config';

export type IngestLlmId = string;

export function resolveIngestLlmProvider(): IngestLlmId {
  const active = getActiveLlmConfig();
  if (active?.provider) return active.provider;
  return process.env.LLM_PROVIDER?.trim() || 'openrouter';
}

export function resolveIngestLlmModel(_provider: IngestLlmId): string {
  return resolveLlmChatModel() || LLM_DEFAULT_CHAT_MODEL;
}

export function hasIngestLlmCredentials(_provider: IngestLlmId): boolean {
  return Boolean(resolveLlmApiKey());
}

/** @deprecated Usar resolveLlmApiKey en llm-config. */
export function openAiApiKeyForLlm(): string | null {
  const k = resolveLlmApiKey();
  return k || null;
}
