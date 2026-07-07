import type { UpdateLlmSettingsDto } from '../llm-settings.types';
import type { ProviderId } from '../llm-catalog';

export class UpdateLlmSettingsBodyDto implements UpdateLlmSettingsDto {
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
