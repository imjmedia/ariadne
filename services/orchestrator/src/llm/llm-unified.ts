/**
 * LLM vía LLM_PROVIDER env (openrouter por defecto). Variables: LLM_API_KEY, LLM_CHAT_MODEL, etc.
 * Prioridad: runtime desde ingest (Ajustes) → env.
 * @see llm-config.ts
 */
import { LLM_DEFAULT_CHAT_MODEL } from './llm-config';
import { getOrchestratorLlmRuntimeSync } from './llm-settings.client';
import { resolveLlmApiKey } from './llm-config';

export type UnifiedLlmProvider = string;

export function resolveLlmProvider(): UnifiedLlmProvider {
  const rt = getOrchestratorLlmRuntimeSync();
  if (rt.provider) return rt.provider;
  return process.env.LLM_PROVIDER?.trim() || 'openrouter';
}

export function resolveLlmModel(_provider: UnifiedLlmProvider): string {
  const rt = getOrchestratorLlmRuntimeSync();
  if (rt.orchestratorChatModel) return rt.orchestratorChatModel;
  return (
    process.env.ORCHESTRATOR_LLM_MODEL?.trim() ||
    process.env.LLM_CHAT_MODEL?.trim() ||
    LLM_DEFAULT_CHAT_MODEL
  );
}

/** Reasoning / audit / intent routing — from Ajustes (router model). */
export function resolveLlmRouterModel(): string {
  const rt = getOrchestratorLlmRuntimeSync();
  return rt.orchestratorRouterModel || rt.orchestratorChatModel || LLM_DEFAULT_CHAT_MODEL;
}

/** Retrieve + synthesize Q&A — from Ajustes (worker model). */
export function resolveLlmWorkerModel(): string {
  const rt = getOrchestratorLlmRuntimeSync();
  return rt.orchestratorWorkerModel || rt.orchestratorChatModel || LLM_DEFAULT_CHAT_MODEL;
}

export function hasLlmCredentials(_provider: UnifiedLlmProvider): boolean {
  return Boolean(resolveLlmApiKey());
}

/** @deprecated Claves directas a proveedores eliminadas; usar resolveLlmApiKey en llm-config. */
export function openAiApiKeyForLlm(): string | null {
  const k = resolveLlmApiKey();
  return k || null;
}
