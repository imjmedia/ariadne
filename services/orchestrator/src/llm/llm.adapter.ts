import { extractOpenRouterProviderMessage, mapOpenRouterHttpError } from 'ariadne-common';
import { orchestratorLlmModel, orchestratorLlmRouterModel, orchestratorLlmWorkerModel } from './orchestrator-llm-config';
import {
  llmDefaultHeaders,
  resolveLlmApiKey,
  resolveLlmBaseUrl,
  resolveLlmTemperature,
} from './llm-config';
import { ensureOrchestratorLlmRuntime } from './llm-settings.client';
import { LlmAuthError } from './llm-auth.error';
import { MoonshotRateLimitError } from './moonshot-rate-limit.error';

function throwMappedOpenRouterError(status: number, bodyText: string, model: string): never {
  const mapped = mapOpenRouterHttpError(status, bodyText, model);
  if (mapped) throw mapped;
  if (status === 429) {
    const msg = extractOpenRouterProviderMessage(bodyText);
    throw new MoonshotRateLimitError(
      `Límite de tasa del proveedor LLM (429) en modelo «${model}». ${msg.slice(0, 400)}`,
    );
  }
  throw new Error(`OpenRouter API ${status}: ${bodyText}`);
}

export type LlmMessage =
  | { role: 'user' | 'assistant' | 'system'; content: string }
  | {
      role: 'assistant';
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    }
  | { role: 'tool'; tool_call_id: string; content: string };

export function stripReasoningFromMessages(messages: LlmMessage[]): LlmMessage[] {
  return messages.map((m) => {
    if (m.role !== 'assistant' || !('reasoning_content' in m)) return m;
    const { reasoning_content: _r, ...rest } = m as {
      reasoning_content?: string | null;
      role: 'assistant';
      content?: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
    return rest as LlmMessage;
  });
}

function chatCompletionsUrl(): string {
  return `${resolveLlmBaseUrl().replace(/\/$/, '')}/chat/completions`;
}

function buildAuthHeaders(): Record<string, string> {
  const key = resolveLlmApiKey();
  if (!key) {
    throw new Error(
      'LLM sin API key. Guarda la clave en Ajustes → Proveedores IA y verifica INGEST_URL en orchestrator.',
    );
  }
  const extra = llmDefaultHeaders();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

export async function callLlm(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  maxTokens: number,
  modelOverride?: string,
): Promise<string> {
  await ensureOrchestratorLlmRuntime();
  const model = modelOverride?.trim() || orchestratorLlmModel();
  const res = await fetch(chatCompletionsUrl(), {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      model,
      messages,
      temperature: resolveLlmTemperature(),
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new LlmAuthError(
        res.status,
        `LLM auth failed (${res.status}) en modelo \`${model}\`: revisa API key (Ajustes → Proveedores IA) y que el orchestrator lea ingest (INGEST_URL). ${err.slice(0, 280)}`,
      );
    }
    if (res.status === 429) {
      const msg = extractOpenRouterProviderMessage(err);
      throw new MoonshotRateLimitError(
        `Límite de tasa del proveedor LLM (429) en modelo «${model}». ${msg.slice(0, 400)}`,
      );
    }
    throwMappedOpenRouterError(res.status, err, model);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  return content ?? '';
}

export async function callLlmWithTools(
  messages: LlmMessage[],
  tools: unknown[],
  maxTokens: number,
  modelOverride?: string,
): Promise<{
  content?: string;
  reasoning_content?: string | null;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
}> {
  await ensureOrchestratorLlmRuntime();
  const model = modelOverride?.trim() || orchestratorLlmModel();
  const res = await fetch(chatCompletionsUrl(), {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      model,
      messages: stripReasoningFromMessages(messages),
      tools,
      tool_choice: 'auto',
      temperature: resolveLlmTemperature(),
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new LlmAuthError(
        res.status,
        `LLM auth failed (${res.status}) en modelo \`${model}\`: revisa API key (Ajustes → Proveedores IA) y que el orchestrator lea ingest (INGEST_URL). ${errText.slice(0, 280)}`,
      );
    }
    if (res.status === 429) {
      const msg = extractOpenRouterProviderMessage(errText);
      throw new MoonshotRateLimitError(
        `Límite de tasa del proveedor LLM (429) en modelo «${model}». ${msg.slice(0, 400)}`,
      );
    }
    throwMappedOpenRouterError(res.status, errText, model);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
        reasoning_content?: string | null;
      };
    }>;
  };
  const msg = data.choices?.[0]?.message as {
    content?: string | null;
    reasoning_content?: string | null;
    tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  };
  const base: {
    content?: string;
    reasoning_content?: string | null;
    tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  } = {
    content: msg?.content?.trim() ?? undefined,
    tool_calls: msg?.tool_calls?.length ? msg.tool_calls : undefined,
  };
  if (msg && 'reasoning_content' in msg) {
    base.reasoning_content = msg.reasoning_content == null ? null : String(msg.reasoning_content);
  }
  return base;
}

/** Chat simple system+user (workflow SDD). */
export async function chatSimple(
  system: string,
  user: string,
  modelOverride?: string,
): Promise<string> {
  await ensureOrchestratorLlmRuntime();
  const key = resolveLlmApiKey();
  if (!key) return '';
  const res = await fetch(chatCompletionsUrl(), {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      model: modelOverride?.trim() || orchestratorLlmModel(),
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.2') || 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `OpenRouter HTTP ${res.status}`);
  }
  return (data.choices?.[0]?.message?.content ?? '').trim();
}
