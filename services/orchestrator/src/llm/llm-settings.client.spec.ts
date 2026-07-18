import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('llm-settings.client', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.INGEST_URL = 'http://ingest:3002';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('prefers ingest runtime and caches db key', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        provider: 'openrouter',
        apiKey: 'sk-db-key',
        baseUrl: 'https://openrouter.ai/api/v1',
        chatModel: 'deepseek/deepseek-v4-flash',
        orchestratorChatModel: 'deepseek/deepseek-v4-flash',
        orchestratorRouterModel: 'x-ai/grok-4.5',
        orchestratorWorkerModel: 'deepseek/deepseek-v4-flash',
        chatIntentRouterEnabled: true,
        temperature: 0.3,
        embeddingProvider: 'openrouter',
        embeddingModel: 'openai/text-embedding-3-small',
        embeddingDimension: 1536,
        extras: {},
        httpReferer: null,
        appTitle: null,
        source: 'db',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const mod = await import('./llm-settings.client');
    mod.invalidateOrchestratorLlmRuntimeCache();

    const rt = await mod.ensureOrchestratorLlmRuntime();
    expect(rt.apiKey).toBe('sk-db-key');
    expect(rt.source).toBe('db');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await mod.ensureOrchestratorLlmRuntime();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when ingest returns runtime without api key', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        provider: 'openrouter',
        apiKey: '',
        baseUrl: 'https://openrouter.ai/api/v1',
        chatModel: 'deepseek/deepseek-v4-flash',
        orchestratorChatModel: 'deepseek/deepseek-v4-flash',
        orchestratorRouterModel: 'deepseek/deepseek-v4-flash',
        orchestratorWorkerModel: 'deepseek/deepseek-v4-flash',
        chatIntentRouterEnabled: true,
        temperature: 0.3,
        embeddingProvider: 'openrouter',
        embeddingModel: 'openai/text-embedding-3-small',
        embeddingDimension: 1536,
        extras: {},
        httpReferer: null,
        appTitle: null,
        source: 'db',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const mod = await import('./llm-settings.client');
    mod.invalidateOrchestratorLlmRuntimeCache();

    await expect(mod.fetchOrchestratorLlmRuntime()).rejects.toThrow(/Ajustes/);
  });
});
