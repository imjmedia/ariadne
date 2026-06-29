/**
 * @fileoverview Embeddings: OpenRouter (cloud) and Ollama (local dev).
 */
import type { EmbeddingProvider } from '../embedding.interface';
import type { EmbeddingSpaceEntity } from '../entities/embedding-space.entity';
import {
  OpenRouterEmbeddingProvider,
  createOpenRouterProviderFromModel,
} from './openrouter.provider';
import {
  OllamaEmbeddingProvider,
  createOllamaProviderFromModel,
} from './ollama.provider';

/**
 * Crea el proveedor según EMBEDDING_PROVIDER (default: openrouter). `openai` se trata como alias de OpenRouter.
 */
export function createEmbeddingProvider(): EmbeddingProvider | null {
  const id = (process.env.EMBEDDING_PROVIDER ?? 'openrouter').toLowerCase();
  if (id === 'ollama') {
    const p = new OllamaEmbeddingProvider();
    return p.isAvailable() ? p : null;
  }
  if (id !== 'openrouter' && id !== 'openai') {
    return null;
  }
  const p = new OpenRouterEmbeddingProvider();
  return p.isAvailable() ? p : null;
}

/**
 * Instancia un proveedor alineado con `embedding_spaces`.
 */
export function createEmbeddingProviderFromSpace(
  space: Pick<EmbeddingSpaceEntity, 'provider' | 'modelId' | 'dimension'>,
): EmbeddingProvider | null {
  const id = space.provider.toLowerCase();
  if (id === 'ollama') {
    const p = createOllamaProviderFromModel(space.modelId, space.dimension);
    return p.isAvailable() ? p : null;
  }
  if (id === 'openrouter' || id === 'openai') {
    const p = createOpenRouterProviderFromModel(space.modelId, space.dimension);
    return p.isAvailable() ? p : null;
  }
  return null;
}
