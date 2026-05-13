/**
 * Embeddings vía OpenRouter (`/v1/embeddings`, compatible OpenAI).
 */
import type { EmbeddingProvider } from '../embedding.interface';
import {
  defaultEmbeddingDimension,
  llmDefaultHeaders,
  resolveLlmApiKey,
  resolveLlmBaseUrl,
  resolveLlmEmbeddingModel,
} from '../../llm/llm-config';

export type OpenRouterEmbeddingProviderOptions = {
  model?: string;
  dimensions?: number;
};

function toOpenRouterEmbeddingModel(modelId: string): string {
  const m = modelId.trim();
  if (m.includes('/')) return m;
  if (m.startsWith('text-embedding')) return `openai/${m}`;
  return m;
}

export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openrouter';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimension: number;

  constructor(opts?: OpenRouterEmbeddingProviderOptions) {
    this.apiKey = resolveLlmApiKey();
    this.model = (opts?.model?.trim() || resolveLlmEmbeddingModel()).trim();
    this.dimension = opts?.dimensions ?? defaultEmbeddingDimension();
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  getDimension(): number {
    return this.dimension;
  }

  async embed(text: string): Promise<number[]> {
    const vecs = await this.embedBatch([text]);
    return vecs[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('LLM_API_KEY required for OpenRouter embeddings');
    }
    if (texts.length === 0) return [];
    const base = resolveLlmBaseUrl().replace(/\/$/, '');
    const body: Record<string, unknown> = {
      model: this.model,
      input: texts.map(t => t.slice(0, 8191)),
    };
    if (this.model.includes('text-embedding-3')) {
      body.dimensions = this.dimension;
    }
    const extra = llmDefaultHeaders();
    const res = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...extra,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter embedding failed: ${res.status} ${err}`);
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    if (!Array.isArray(data.data) || data.data.length !== texts.length) {
      throw new Error(
        `Unexpected batch embedding response: expected ${texts.length} items, got ${data.data?.length ?? 'n/a'}`,
      );
    }
    return data.data.map((item, i) => {
      const vec = item.embedding;
      if (!Array.isArray(vec) || vec.length !== this.dimension) {
        throw new Error(
          `Unexpected embedding shape at index ${i}: expected ${this.dimension}, got ${Array.isArray(vec) ? vec.length : 'n/a'}`,
        );
      }
      return vec;
    });
  }
}

/** Fábrica usada con filas `embedding_spaces` (openrouter u openai legado vía el mismo API). */
export function createOpenRouterProviderFromModel(
  modelId: string,
  dimension: number,
): OpenRouterEmbeddingProvider {
  return new OpenRouterEmbeddingProvider({
    model: toOpenRouterEmbeddingModel(modelId),
    dimensions: dimension,
  });
}
