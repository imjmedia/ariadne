import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OllamaEmbeddingProvider,
  createOllamaProviderFromModel,
  OLLAMA_DEFAULT_BASE,
} from './ollama.provider';

function makeVec(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i * 0.001);
}

describe('OllamaEmbeddingProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_EMBED_MODEL;
    delete process.env.LLM_EMBEDDING_DIM;
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAvailable()', () => {
    it('returns true with default config', () => {
      expect(new OllamaEmbeddingProvider().isAvailable()).toBe(true);
    });
  });

  describe('getDimension()', () => {
    it('defaults to 1536 without env', () => {
      expect(new OllamaEmbeddingProvider().getDimension()).toBe(1536);
    });

    it('respects LLM_EMBEDDING_DIM env (768 for nomic)', () => {
      process.env.LLM_EMBEDDING_DIM = '768';
      expect(new OllamaEmbeddingProvider().getDimension()).toBe(768);
    });
  });

  describe('embed()', () => {
    it('calls POST /api/embeddings with prompt', async () => {
      const vec = makeVec(768);
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: vec }),
      } as Response);

      const p = new OllamaEmbeddingProvider({ dimensions: 768, baseUrl: OLLAMA_DEFAULT_BASE });
      const result = await p.embed('hello');
      expect(result).toEqual(vec);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${OLLAMA_DEFAULT_BASE}/api/embeddings`);
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('nomic-embed-text');
      expect(body.prompt).toBe('hello');
    });

    it('throws clear error when Ollama unreachable', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
      } as Response);

      const p = new OllamaEmbeddingProvider({ dimensions: 768 });
      await expect(p.embed('test')).rejects.toThrow(/Ollama embedding failed/);
    });

    it('throws when vector dimension mismatches', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: makeVec(512) }),
      } as Response);

      const p = new OllamaEmbeddingProvider({ dimensions: 768 });
      await expect(p.embed('test')).rejects.toThrow('768');
    });
  });

  describe('embedBatch()', () => {
    it('returns empty array without fetch for empty input', async () => {
      const p = new OllamaEmbeddingProvider({ dimensions: 768 });
      await expect(p.embedBatch!([])).resolves.toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('createOllamaProviderFromModel()', () => {
    it('uses model from space row', () => {
      const p = createOllamaProviderFromModel('mxbai-embed-large', 1024);
      expect(p.getDimension()).toBe(1024);
    });
  });
});
