/**
 * Runtime LLM desde ingest (Ajustes en BD) con cache TTL y fallback a env.
 */

export interface OrchestratorLlmRuntime {
  provider: string;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  orchestratorChatModel: string;
  orchestratorRouterModel: string;
  orchestratorWorkerModel: string;
  chatIntentRouterEnabled: boolean;
  temperature: number;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimension: number;
  extras: Record<string, unknown>;
  httpReferer: string | null;
  appTitle: string | null;
  source: 'db' | 'env';
}

let cached: OrchestratorLlmRuntime | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 45_000;

function ingestBase(): string {
  return (process.env.INGEST_URL ?? 'http://localhost:3002').replace(/\/$/, '');
}

function buildFromEnv(): OrchestratorLlmRuntime {
  const chatModel =
    process.env.ORCHESTRATOR_LLM_MODEL?.trim() ||
    process.env.LLM_CHAT_MODEL?.trim() ||
    'google/gemini-2.0-flash-001';
  const orchestratorChatModel = chatModel;
  const embeddingModel = process.env.LLM_EMBEDDING_MODEL?.trim() || 'openai/text-embedding-3-small';
  const embeddingDimRaw = process.env.LLM_EMBEDDING_DIM?.trim();
  const embeddingDimension = embeddingDimRaw ? parseInt(embeddingDimRaw, 10) : 1536;
  const temperature = parseFloat(process.env.LLM_TEMPERATURE || '0.1');

  return {
    provider: process.env.LLM_PROVIDER?.trim() || 'openrouter',
    apiKey: process.env.LLM_API_KEY?.trim() ?? '',
    baseUrl: process.env.LLM_BASE_URL?.trim() || 'https://openrouter.ai/api/v1',
    chatModel,
    orchestratorChatModel,
    orchestratorRouterModel: orchestratorChatModel,
    orchestratorWorkerModel: orchestratorChatModel,
    chatIntentRouterEnabled: true,
    temperature: Number.isFinite(temperature) ? temperature : 0.1,
    embeddingProvider: process.env.LLM_PROVIDER?.trim() || 'openrouter',
    embeddingModel,
    embeddingDimension: Number.isFinite(embeddingDimension) ? embeddingDimension : 1536,
    extras: {},
    httpReferer: process.env.LLM_HTTP_REFERER?.trim() || null,
    appTitle: process.env.LLM_APP_TITLE?.trim() || null,
    source: 'env',
  };
}

export async function fetchOrchestratorLlmRuntime(): Promise<OrchestratorLlmRuntime> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const url = `${ingestBase()}/internal/llm-runtime`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`ingest llm-runtime ${res.status}`);
    }
    const data = (await res.json()) as OrchestratorLlmRuntime;
    cached = data;
    cachedAt = now;
    return data;
  } catch {
    const envRuntime = buildFromEnv();
    cached = envRuntime;
    cachedAt = now;
    return envRuntime;
  }
}

/** Lectura sync: usa cache si existe; si no, env (hasta que prefetch complete). */
export function getCachedOrchestratorLlmRuntime(): OrchestratorLlmRuntime | null {
  return cached;
}

export function getOrchestratorLlmRuntimeSync(): OrchestratorLlmRuntime {
  return cached ?? buildFromEnv();
}

/** Prefetch al arrancar el servicio (no bloquea requests si falla). */
export function prefetchOrchestratorLlmRuntime(): void {
  void fetchOrchestratorLlmRuntime();
}

export function invalidateOrchestratorLlmRuntimeCache(): void {
  cached = null;
  cachedAt = 0;
}
