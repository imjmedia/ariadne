import { describe, expect, it, vi } from 'vitest';
import { ChatIntentRouterAgent } from './chat-intent-router.agent';
import { OrchestratorLlmService } from '../orchestrator-llm.service';
import * as llmSettingsClient from '../../llm/llm-settings.client';

describe('ChatIntentRouterAgent keyword fallback', () => {
  const agent = new ChatIntentRouterAgent({} as OrchestratorLlmService);

  it('classifies media coupling as reengineering when LLM router is disabled in Ajustes', async () => {
    vi.spyOn(llmSettingsClient, 'getOrchestratorLlmRuntimeSync').mockReturnValue({
      provider: 'openrouter',
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      chatModel: 'test',
      orchestratorChatModel: 'test',
      orchestratorRouterModel: 'test',
      orchestratorWorkerModel: 'test',
      chatIntentRouterEnabled: false,
      temperature: 0.1,
      embeddingProvider: null,
      embeddingModel: null,
      embeddingDimension: 1536,
      extras: {},
      httpReferer: null,
      appTitle: null,
      source: 'db',
    });
    const msg =
      'tenemos acoplada la creación de medios, incluso a nivel de una entidad de bd por medio, necesitamos desacoplar';
    const route = await agent.classify(msg);
    expect(route.intent).toBe('reengineering');
    expect(route.source).toBe('keyword_fallback');
    vi.restoreAllMocks();
  });
});
