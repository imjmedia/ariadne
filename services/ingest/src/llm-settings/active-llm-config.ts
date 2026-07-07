/**
 * Singleton en memoria para lectura sync desde llm-config (chat, embeddings).
 * Se hidrata al arrancar y tras cada update en LlmSettingsService.
 */
import type { LlmRuntimeConfig } from './llm-settings.types';

let active: LlmRuntimeConfig | null = null;

export function setActiveLlmConfig(config: LlmRuntimeConfig | null): void {
  active = config;
}

export function getActiveLlmConfig(): LlmRuntimeConfig | null {
  return active;
}
