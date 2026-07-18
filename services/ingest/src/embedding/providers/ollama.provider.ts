/**
 * Ollama local embedding provider (`POST /api/embeddings`).
 */
import type { EmbeddingProvider } from '../embedding.interface';
import { defaultEmbeddingDimension } from '../../llm/llm-config';

export const OLLAMA_DEFAULT_BASE = 'http://localhost:11434';
export const OLLAMA_DEFAULT_EMBED_MODEL = 'nomic-embed-text';

export type OllamaEmbeddingProviderOptions = {
  baseUrl?: string;
  model?: string;
  dimensions?: number;
};

export function resolveOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL?.trim() || OLLAMA_DEFAULT_BASE).replace(/\/$/, '');
}

export function resolveOllamaEmbedModel(): string {
  return process.env.OLLAMA_EMBED_MODEL?.trim() || OLLAMA_DEFAULT_EMBED_MODEL;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimension: number;

  constructor(opts?: OllamaEmbeddingProviderOptions) {
    this.baseUrl = (opts?.baseUrl?.trim() || resolveOllamaBaseUrl()).replace(/\/$/, '');
    this.model = (opts?.model?.trim() || resolveOllamaEmbedModel()).trim();
    this.dimension = opts?.dimensions ?? defaultEmbeddingDimension();
  }

  isAvailable(): boolean {
    return Boolean(this.baseUrl && this.model);
  }

  getDimension(): number {
    return this.dimension;
  }

  async embed(text: string): Promise<number[]> {
    const vecs = await this.embedBatch([text]);
    return vecs[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];
    for (const text of texts) {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text.slice(0, 8191),
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(
          `Ollama embedding failed (${this.baseUrl}, model=${this.model}): ${res.status} ${err}`,
        );
      }
      const data = (await res.json()) as { embedding?: number[] };
      const vec = data.embedding;
      if (!Array.isArray(vec) || vec.length !== this.dimension) {
        throw new Error(
          `Unexpected Ollama embedding shape: expected ${this.dimension}, got ${Array.isArray(vec) ? vec.length : 'n/a'}`,
        );
      }
      results.push(vec);
    }
    return results;
  }
}

/** Factory aligned with `embedding_spaces` rows. */
export function createOllamaProviderFromModel(
  modelId: string,
  dimension: number,
): OllamaEmbeddingProvider {
  return new OllamaEmbeddingProvider({
    model: modelId.trim() || resolveOllamaEmbedModel(),
    dimensions: dimension,
  });
}
