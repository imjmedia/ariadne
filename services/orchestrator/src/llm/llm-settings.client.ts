/**
 * Runtime LLM desde ingest (Ajustes en BD) con cache TTL.
 * La API key solo vive en Ajustes — no se lee LLM_API_KEY de env.
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
let inflight: Promise<OrchestratorLlmRuntime> | null = null;
const CACHE_TTL_MS = 45_000;

function ingestBase(): string {
  return (process.env.INGEST_URL ?? 'http://localhost:3002').replace(/\/$/, '');
}

/** Defaults de modelo/URL cuando aún no hay cache (sin API key). */
function emptyRuntimeDefaults(): OrchestratorLlmRuntime {
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
    apiKey: '',
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
  if (cached && now - cachedAt < CACHE_TTL_MS && cached.apiKey) {
    return cached;
  }

  const url = `${ingestBase()}/internal/llm-runtime`;
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `No se pudo cargar LLM desde ingest (${url}): ${msg}. ` +
        'Verifica INGEST_URL en orchestrator y que el servicio ingest esté healthy.',
    );
  }
  if (!res.ok) {
    throw new Error(
      `No se pudo cargar LLM desde ingest (${url}): HTTP ${res.status}. ` +
        'Verifica INGEST_URL y que ingest tenga la API key en Ajustes → Proveedores IA.',
    );
  }
  const data = (await res.json()) as OrchestratorLlmRuntime;
  if (!data.apiKey?.trim()) {
    throw new Error(
      'API key LLM no configurada. Guarda la clave en Ajustes → Proveedores IA (Plataforma → Ajustes).',
    );
  }
  cached = data;
  cachedAt = now;
  return data;
}

/** Garantiza runtime fresco antes de llamar al proveedor (evita carrera con prefetch al arrancar). */
export async function ensureOrchestratorLlmRuntime(): Promise<OrchestratorLlmRuntime> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS && cached.apiKey) {
    return cached;
  }
  if (!inflight) {
    inflight = fetchOrchestratorLlmRuntime().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Lectura sync: usa cache si existe; si no, defaults sin API key (hasta ensureOrchestratorLlmRuntime). */
export function getCachedOrchestratorLlmRuntime(): OrchestratorLlmRuntime | null {
  return cached;
}

export function getOrchestratorLlmRuntimeSync(): OrchestratorLlmRuntime {
  return cached ?? emptyRuntimeDefaults();
}

/** Prefetch al arrancar el servicio (no bloquea requests si falla). */
export function prefetchOrchestratorLlmRuntime(): void {
  void fetchOrchestratorLlmRuntime().catch((err) => {
    console.warn(
      `[orchestrator-llm] Prefetch falló: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
}

export function invalidateOrchestratorLlmRuntimeCache(): void {
  cached = null;
  cachedAt = 0;
  inflight = null;
}
