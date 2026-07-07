/**
 * Catálogo estático de proveedores LLM (OpenAI-compatible /chat/completions).
 */

export const PROVIDER_IDS = [
  'openrouter',
  'openai',
  'anthropic',
  'gemini',
  'groq',
  'cloudflare',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const CLOUDFLARE_BASE_URL_TEMPLATE =
  'https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1';

export function buildCloudflareBaseUrl(accountId: string): string {
  const id = accountId.trim();
  if (!id) throw new Error('Cloudflare accountId is required to build base URL');
  return CLOUDFLARE_BASE_URL_TEMPLATE.replace('{accountId}', encodeURIComponent(id));
}

export function resolveCloudflareAccountId(
  extras?: Record<string, unknown> | null,
  baseUrl?: string | null,
): string | null {
  const fromExtras = typeof extras?.accountId === 'string' ? extras.accountId.trim() : '';
  if (fromExtras) return fromExtras;
  const url = baseUrl?.trim();
  if (!url) return null;
  const match = url.match(/\/accounts\/([^/]+)\/ai\/v1\/?$/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

export interface ProviderExtraFieldSpec {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface ProviderCatalogEntry {
  id: ProviderId;
  label: string;
  apiKeyHelpUrl?: string;
  defaultChatModel: string;
  chatModels?: string[];
  defaultEmbeddingModel: string | null;
  embeddingModels?: string[];
  defaultEmbeddingDimension: number | null;
  defaultBaseUrl: string;
  baseUrlEditable?: boolean;
  extraFields?: ProviderExtraFieldSpec[];
  supportsEmbeddings: boolean;
}

export const EMBEDDING_DIMENSION_BY_MODEL: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'openai/text-embedding-3-small': 1536,
  'openai/text-embedding-3-large': 3072,
  'text-embedding-004': 768,
  '@cf/baai/bge-base-en-v1.5': 768,
  '@cf/baai/bge-large-en-v1.5': 1024,
};

export const PROVIDER_CATALOG: Record<ProviderId, ProviderCatalogEntry> = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    apiKeyHelpUrl: 'https://openrouter.ai/keys',
    defaultChatModel: 'google/gemini-2.0-flash-001',
    chatModels: [
      'google/gemini-2.0-flash-001',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    defaultEmbeddingModel: 'openai/text-embedding-3-small',
    embeddingModels: ['openai/text-embedding-3-small', 'openai/text-embedding-3-large'],
    defaultEmbeddingDimension: 1536,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    supportsEmbeddings: true,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    apiKeyHelpUrl: 'https://platform.openai.com/api-keys',
    defaultChatModel: 'gpt-4o-mini',
    chatModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    defaultEmbeddingModel: 'text-embedding-3-small',
    embeddingModels: ['text-embedding-3-small', 'text-embedding-3-large'],
    defaultEmbeddingDimension: 1536,
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportsEmbeddings: true,
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    apiKeyHelpUrl: 'https://console.anthropic.com/settings/keys',
    defaultChatModel: 'claude-3-5-sonnet-20241022',
    chatModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    defaultEmbeddingModel: null,
    embeddingModels: [],
    defaultEmbeddingDimension: null,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    supportsEmbeddings: false,
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    apiKeyHelpUrl: 'https://aistudio.google.com/apikey',
    defaultChatModel: 'gemini-2.0-flash',
    chatModels: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultEmbeddingModel: 'text-embedding-004',
    embeddingModels: ['text-embedding-004'],
    defaultEmbeddingDimension: 768,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    supportsEmbeddings: true,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    apiKeyHelpUrl: 'https://console.groq.com/keys',
    defaultChatModel: 'llama-3.3-70b-versatile',
    chatModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultEmbeddingModel: null,
    embeddingModels: [],
    defaultEmbeddingDimension: null,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    supportsEmbeddings: false,
  },
  cloudflare: {
    id: 'cloudflare',
    label: 'Cloudflare Workers AI',
    apiKeyHelpUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    defaultChatModel: '@cf/meta/llama-3.1-8b-instruct',
    chatModels: ['@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-small-3.1-24b-instruct'],
    defaultEmbeddingModel: '@cf/baai/bge-base-en-v1.5',
    embeddingModels: ['@cf/baai/bge-base-en-v1.5', '@cf/baai/bge-large-en-v1.5'],
    defaultEmbeddingDimension: 768,
    defaultBaseUrl: CLOUDFLARE_BASE_URL_TEMPLATE,
    baseUrlEditable: true,
    extraFields: [
      {
        key: 'accountId',
        label: 'Account ID',
        required: true,
        placeholder: 'Cloudflare account ID',
        helpText: 'Required to build the Workers AI base URL.',
      },
    ],
    supportsEmbeddings: true,
  },
};

export function getCatalogList(): ProviderCatalogEntry[] {
  return PROVIDER_IDS.map((id) => PROVIDER_CATALOG[id]);
}

export function getCatalogEntry(provider: string): ProviderCatalogEntry | null {
  return isProviderId(provider) ? PROVIDER_CATALOG[provider] : null;
}

export function resolveEmbeddingDimension(model: string, fallback: number): number {
  const m = model.trim();
  return EMBEDDING_DIMENSION_BY_MODEL[m] ?? fallback;
}
