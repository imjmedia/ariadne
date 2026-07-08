/**
 * LLM del orchestrator — tiered models (router vs worker).
 */
import { Injectable } from '@nestjs/common';
import {
  callOrchestratorLlm,
  callOrchestratorLlmWithTools,
  type LlmMessage,
} from '../llm/orchestrator-llm.facade';

function toolCallMaxTokensFromEnv(): number {
  const raw = process.env.CHAT_TOOL_CALL_MAX_TOKENS?.trim();
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 1024) return Math.min(n, 32_000);
  return 8192;
}

@Injectable()
export class OrchestratorLlmService {
  /** Default tier (worker) — synthesis, modification-plan questions. */
  async callLlm(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    maxTokens = 1024,
    tier: 'default' | 'router' | 'worker' = 'worker',
  ): Promise<string> {
    return callOrchestratorLlm(messages, maxTokens, tier);
  }

  /** Worker tier — ReAct retrieve with tools. */
  async callLlmWithTools(
    messages: LlmMessage[],
    tools: unknown[],
    maxTokens = toolCallMaxTokensFromEnv(),
  ): Promise<{
    content?: string;
    reasoning_content?: string | null;
    tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  }> {
    return callOrchestratorLlmWithTools(messages, tools, maxTokens, 'worker');
  }

  /** Router tier — intent classification and architecture audit. */
  async callRouterLlm(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    maxTokens = 1024,
  ): Promise<string> {
    return callOrchestratorLlm(messages, maxTokens, 'router');
  }
}
