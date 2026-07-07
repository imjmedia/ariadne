import type { ProviderId } from './llm-catalog';

/** Runtime efectivo con API key descifrada — solo uso interno (ingest/orchestrator). */
export interface LlmRuntimeConfig {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  orchestratorChatModel: string;
  temperature: number;
  embeddingProvider: ProviderId | null;
  embeddingModel: string | null;
  embeddingDimension: number;
  extras: Record<string, unknown>;
  httpReferer: string | null;
  appTitle: string | null;
  source: 'db' | 'env';
}

/** Respuesta pública (sin API key completa). */
export interface LlmSettingsMasked {
  provider: ProviderId;
  apiKeyHint: string | null;
  hasApiKey: boolean;
  baseUrl: string;
  chatModel: string;
  orchestratorChatModel: string | null;
  temperature: number;
  embeddingProvider: ProviderId | null;
  embeddingModel: string | null;
  embeddingDimension: number;
  extras: Record<string, unknown>;
  httpReferer: string | null;
  appTitle: string | null;
  source: 'db' | 'env';
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UpdateLlmSettingsDto {
  provider?: ProviderId;
  apiKey?: string;
  baseUrl?: string;
  chatModel?: string;
  orchestratorChatModel?: string | null;
  temperature?: number;
  embeddingProvider?: ProviderId | null;
  embeddingModel?: string | null;
  embeddingDimension?: number;
  extras?: Record<string, unknown>;
  httpReferer?: string | null;
  appTitle?: string | null;
}

export interface LlmTestConnectionResult {
  ok: boolean;
  statusCode?: number;
  message: string;
  model?: string;
}
