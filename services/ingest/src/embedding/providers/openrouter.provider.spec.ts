import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OpenRouterEmbeddingProvider,
  createOpenRouterProviderFromModel,
} from './openrouter.provider';

function makeVec(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i * 0.001);
}

describe('OpenRouterEmbeddingProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_EMBEDDING_MODEL;
    delete process.env.LLM_EMBEDDING_DIM;
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── isAvailable ──────────────────────────────────────────────────────────

  describe('isAvailable()', () => {
    it('returns false when LLM_API_KEY missing', () => {
      expect(new OpenRouterEmbeddingProvider().isAvailable()).toBe(false);
    });

    it('returns true when LLM_API_KEY set', () => {
      process.env.LLM_API_KEY = 'sk-test';
      expect(new OpenRouterEmbeddingProvider().isAvailable()).toBe(true);
    });
  });

  // ── getDimension ─────────────────────────────────────────────────────────

  describe('getDimension()', () => {
    it('defaults to 1536', () => {
      expect(new OpenRouterEmbeddingProvider().getDimension()).toBe(1536);
    });

    it('uses opts.dimensions when provided', () => {
      expect(new OpenRouterEmbeddingProvider({ dimensions: 768 }).getDimension()).toBe(768);
    });

    it('respects LLM_EMBEDDING_DIM env', () => {
      process.env.LLM_EMBEDDING_DIM = '3072';
      expect(new OpenRouterEmbeddingProvider().getDimension()).toBe(3072);
    });
  });

  // ── embed ─────────────────────────────────────────────────────────────────

  describe('embed()', () => {
    beforeEach(() => {
      process.env.LLM_API_KEY = 'sk-test';
    });

    function mockOk(vec: number[]) {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: vec }] }),
      } as Response);
    }

    it('throws when LLM_API_KEY missing', async () => {
      delete process.env.LLM_API_KEY;
      const p = new OpenRouterEmbeddingProvider({ dimensions: 1536 });
      await expect(p.embed('test')).rejects.toThrow('LLM_API_KEY');
    });

    it('returns the embedding vector', async () => {
      const vec = makeVec(1536);
      mockOk(vec);
      const result = await new OpenRouterEmbeddingProvider({ dimensions: 1536 }).embed('hello');
      expect(result).toEqual(vec);
    });

    it('calls POST /embeddings with input as single-element array', async () => {
      mockOk(makeVec(1536));
      await new OpenRouterEmbeddingProvider({ dimensions: 1536 }).embed('hello world');
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/embeddings$/);
      const body = JSON.parse(init.body as string);
      expect(body.input).toEqual(['hello world']);
    });

    it('slices input text to 8191 chars', async () => {
      mockOk(makeVec(1536));
      await new OpenRouterEmbeddingProvider({ dimensions: 1536 }).embed('x'.repeat(10_000));
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.input[0].length).toBe(8191);
    });

    it('includes dimensions param for text-embedding-3 models', async () => {
      mockOk(makeVec(512));
      const p = new OpenRouterEmbeddingProvider({
        model: 'openai/text-embedding-3-small',
        dimensions: 512,
      });
      await p.embed('test');
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.dimensions).toBe(512);
    });

    it('omits dimensions param for non-text-embedding-3 models', async () => {
      mockOk(makeVec(768));
      const p = new OpenRouterEmbeddingProvider({
        model: 'nomic/nomic-embed-text-v1',
        dimensions: 768,
      });
      await p.embed('test');
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.dimensions).toBeUndefined();
    });

    it('throws on non-ok HTTP response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limit',
      } as Response);
      await expect(new OpenRouterEmbeddingProvider({ dimensions: 1536 }).embed('t')).rejects.toThrow(
        '429',
      );
    });

    it('throws when vector dimension mismatches declared dimension', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: makeVec(768) }] }),
      } as Response);
      await expect(new OpenRouterEmbeddingProvider({ dimensions: 1536 }).embed('t')).rejects.toThrow(
        '1536',
      );
    });

    it('uses LLM_BASE_URL env when set', async () => {
      process.env.LLM_BASE_URL = 'https://my-proxy.example.com/v1';
      mockOk(makeVec(1536));
      await new OpenRouterEmbeddingProvider({ dimensions: 1536 }).embed('test');
      expect(fetchSpy.mock.calls[0][0] as string).toContain('my-proxy.example.com');
    });

    it('sends Authorization header with Bearer token', async () => {
      mockOk(makeVec(1536));
      await new OpenRouterEmbeddingProvider({ dimensions: 1536 }).embed('test');
      const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer sk-test');
    });
  });

  // ── embedBatch ────────────────────────────────────────────────────────────

  describe('embedBatch()', () => {
    beforeEach(() => {
      process.env.LLM_API_KEY = 'sk-test';
    });

    function mockBatchOk(vecs: number[][]) {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: vecs.map(embedding => ({ embedding })) }),
      } as Response);
    }

    it('returns empty array for empty input without calling fetch', async () => {
      const p = new OpenRouterEmbeddingProvider({ dimensions: 4 });
      const result = await p.embedBatch!([]);
      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends input as array and returns vectors in order', async () => {
      const vec1 = makeVec(4);
      const vec2 = makeVec(4).reverse();
      mockBatchOk([vec1, vec2]);
      const p = new OpenRouterEmbeddingProvider({ dimensions: 4 });
      const result = await p.embedBatch!(['text A', 'text B']);
      expect(result[0]).toEqual(vec1);
      expect(result[1]).toEqual(vec2);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.input).toEqual(['text A', 'text B']);
    });

    it('slices each text to 8191 chars', async () => {
      const vec = makeVec(4);
      mockBatchOk([vec, vec]);
      const p = new OpenRouterEmbeddingProvider({ dimensions: 4 });
      await p.embedBatch!(['a'.repeat(10_000), 'b'.repeat(10_000)]);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect((body.input as string[])[0].length).toBe(8191);
      expect((body.input as string[])[1].length).toBe(8191);
    });

    it('throws when response item count mismatches input count', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: makeVec(4) }] }), // 1 item for 2 inputs
      } as Response);
      const p = new OpenRouterEmbeddingProvider({ dimensions: 4 });
      await expect(p.embedBatch!(['a', 'b'])).rejects.toThrow('expected 2 items');
    });

    it('throws when one vector has wrong dimension', async () => {
      mockBatchOk([makeVec(4), makeVec(8)]); // second has wrong dim
      const p = new OpenRouterEmbeddingProvider({ dimensions: 4 });
      await expect(p.embedBatch!(['a', 'b'])).rejects.toThrow('index 1');
    });

    it('throws on non-ok HTTP response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limit',
      } as Response);
      const p = new OpenRouterEmbeddingProvider({ dimensions: 4 });
      await expect(p.embedBatch!(['a'])).rejects.toThrow('429');
    });

    it('throws when LLM_API_KEY missing', async () => {
      delete process.env.LLM_API_KEY;
      const p = new OpenRouterEmbeddingProvider({ dimensions: 4 });
      await expect(p.embedBatch!(['a'])).rejects.toThrow('LLM_API_KEY');
    });
  });

  // ── createOpenRouterProviderFromModel ─────────────────────────────────────

  describe('createOpenRouterProviderFromModel()', () => {
    it('preserves dimension', () => {
      process.env.LLM_API_KEY = 'k';
      expect(createOpenRouterProviderFromModel('text-embedding-3-small', 1536).getDimension()).toBe(
        1536,
      );
    });

    it('passes through model with slash as-is', () => {
      process.env.LLM_API_KEY = 'k';
      const p = createOpenRouterProviderFromModel('nomic/nomic-embed-text-v1', 768);
      expect(p.getDimension()).toBe(768);
    });

    it('prefixes bare text-embedding model with openai/', async () => {
      process.env.LLM_API_KEY = 'k';
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: makeVec(1536) }] }),
      } as Response);
      const p = createOpenRouterProviderFromModel('text-embedding-3-small', 1536);
      await p.embed('test');
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.model).toBe('openai/text-embedding-3-small');
    });
  });
});
