import {
  callLlm,
  callLlmWithTools,
  chatSimple,
  type LlmMessage,
} from './llm.adapter';
import { resolveLlmRouterModel, resolveLlmWorkerModel } from './llm-unified';
import { withLlmRequestThrottle } from './llm-request-throttle';

export type { LlmMessage };

export async function callOrchestratorLlm(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  maxTokens: number,
  tier: 'default' | 'router' | 'worker' = 'default',
): Promise<string> {
  const model =
    tier === 'router'
      ? resolveLlmRouterModel()
      : tier === 'worker'
        ? resolveLlmWorkerModel()
        : undefined;
  return withLlmRequestThrottle(() => callLlm(messages, maxTokens, model));
}

export async function callOrchestratorLlmWithTools(
  messages: LlmMessage[],
  tools: unknown[],
  maxTokens: number,
  tier: 'default' | 'router' | 'worker' = 'worker',
): Promise<{
  content?: string;
  reasoning_content?: string | null;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
}> {
  const model =
    tier === 'router'
      ? resolveLlmRouterModel()
      : tier === 'worker'
        ? resolveLlmWorkerModel()
        : undefined;
  return withLlmRequestThrottle(() => callLlmWithTools(messages, tools, maxTokens, model));
}

/** System + user (workflow SDD: revisión de código, tests). */
export async function orchestratorChatSimple(
  system: string,
  user: string,
  tier: 'default' | 'router' | 'worker' = 'default',
): Promise<string> {
  const model =
    tier === 'router'
      ? resolveLlmRouterModel()
      : tier === 'worker'
        ? resolveLlmWorkerModel()
        : undefined;
  return withLlmRequestThrottle(() => chatSimple(system, user, model));
}
