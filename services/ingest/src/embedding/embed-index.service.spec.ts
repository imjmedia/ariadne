import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbedIndexService } from './embed-index.service';

// ── Module mocks (hoisted by vitest) ────────────────────────────────────────

vi.mock('falkordb', () => ({
  FalkorDB: { connect: vi.fn() },
}));

vi.mock('../pipeline/falkor', () => ({
  getFalkorConfig: vi.fn(() => ({ host: 'localhost', port: 6379 })),
  effectiveShardMode: vi.fn(() => 'project'),
  listGraphNamesForProjectRouting: vi.fn(() => ['proj_code']),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeVec(dim = 4): number[] {
  return Array.from({ length: dim }, (_, i) => i * 0.1);
}

/** Fake embed provider with controllable embed fn */
function makeEmbedProvider(dim = 4, embedFn?: (t: string) => Promise<number[]>) {
  return {
    embed: embedFn ?? vi.fn().mockResolvedValue(makeVec(dim)),
    getDimension: vi.fn(() => dim),
    isAvailable: vi.fn(() => true),
    id: 'test',
  };
}

/**
 * Creates a graph mock where query() dispatches by label keyword in the Cypher string.
 * Pass nodeRows as a map of label → rows. SET and CREATE INDEX queries return {data:[]}.
 */
function makeGraphMock(nodeRows: Record<string, Record<string, unknown>[]> = {}) {
  const queryFn = vi.fn().mockImplementation(async (cypher: string) => {
    if (cypher.includes('RETURN vecf32')) return { data: [] };
    for (const label of Object.keys(nodeRows)) {
      if (cypher.includes(`:${label}`)) return { data: nodeRows[label] };
    }
    return { data: [] };
  });
  return { query: queryFn };
}

function makeClientMock(graphMock: ReturnType<typeof makeGraphMock>) {
  return {
    selectGraph: vi.fn(() => graphMock),
    close: vi.fn(),
  };
}

type MockRepo = { findOne: ReturnType<typeof vi.fn> };
type MockReposSvc = { findOne: ReturnType<typeof vi.fn>; getProjectIdsForRepo: ReturnType<typeof vi.fn> };
type MockFileContent = { getFileContentSafe: ReturnType<typeof vi.fn> };
type MockSpaces = { getWriteBindingForRepository: ReturnType<typeof vi.fn> };

function makeServiceMocks(overrides: {
  provider?: ReturnType<typeof makeEmbedProvider>;
  projectRows?: Record<string, unknown>[];
  repoProjectIds?: string[];
} = {}) {
  const provider = overrides.provider ?? makeEmbedProvider();
  const repos: MockReposSvc = {
    findOne: vi.fn().mockResolvedValue({ id: 'repo-1' }),
    getProjectIdsForRepo: vi.fn().mockResolvedValue(overrides.repoProjectIds ?? []),
  };
  const fileContent: MockFileContent = {
    getFileContentSafe: vi.fn().mockResolvedValue(null),
  };
  const spaces: MockSpaces = {
    getWriteBindingForRepository: vi.fn().mockResolvedValue({
      provider,
      graphProperty: 'embedding',
    }),
  };
  const projectRepo: MockRepo = {
    findOne: vi.fn().mockResolvedValue(null),
  };
  return { provider, repos, fileContent, spaces, projectRepo };
}

function makeService(mocks: ReturnType<typeof makeServiceMocks>): EmbedIndexService {
  return new EmbedIndexService(
    mocks.repos as never,
    mocks.fileContent as never,
    mocks.spaces as never,
    mocks.projectRepo as never,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EmbedIndexService', () => {
  let FalkorDBMock: { connect: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    const falkorModule = await import('falkordb');
    FalkorDBMock = falkorModule.FalkorDB as unknown as typeof FalkorDBMock;
    vi.clearAllMocks();
  });

  // ── provider not available ────────────────────────────────────────────────

  it('throws when embed provider not available', async () => {
    const mocks = makeServiceMocks();
    mocks.spaces.getWriteBindingForRepository.mockResolvedValue({
      provider: { isAvailable: () => false },
      graphProperty: 'embedding',
    });
    const svc = makeService(mocks);
    await expect(svc.runEmbedIndex('repo-1')).rejects.toThrow('Embedding provider not configured');
  });

  // ── empty graph ───────────────────────────────────────────────────────────

  it('returns {indexed:0, errors:0} when graph has no nodes', async () => {
    const mocks = makeServiceMocks();
    const graph = makeGraphMock();
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result).toEqual({ indexed: 0, errors: 0 });
  });

  // ── vecf32 not supported ──────────────────────────────────────────────────

  it('returns {indexed:0, errors:0} early when vecf32 probe throws', async () => {
    const mocks = makeServiceMocks();
    const graph = {
      query: vi.fn().mockRejectedValue(new Error("Unknown function 'vecf32'")),
    };
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result).toEqual({ indexed: 0, errors: 0 });
    expect(mocks.provider.embed).not.toHaveBeenCalled();
  });

  // ── Function nodes ────────────────────────────────────────────────────────

  it('embeds Function nodes and writes vecf32 to graph', async () => {
    const mocks = makeServiceMocks();
    const graph = makeGraphMock({
      Function: [{ path: 'src/a.ts', name: 'foo', description: 'does foo', startLine: null, endLine: null }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.indexed).toBe(1);
    expect(result.errors).toBe(0);
    expect(mocks.provider.embed).toHaveBeenCalledWith('foo src/a.ts does foo');
    const setCalls = (graph.query as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([cypher]) => typeof cypher === 'string' && cypher.includes('SET'),
    );
    expect(setCalls.length).toBeGreaterThanOrEqual(1);
    // UNWIND-based writes use item.vec, not $vec directly
    expect(setCalls[0][0]).toContain('vecf32(item.vec)');
  });

  it('uses file content slice for Function when startLine/endLine present', async () => {
    const mocks = makeServiceMocks();
    // slice must be > 30 chars to replace name+path text (see embed-index.service.ts)
    mocks.fileContent.getFileContentSafe.mockResolvedValue(
      ['line1', 'function foo(param: string): boolean {', '  return param.length > 0;', '}'].join('\n'),
    );
    const graph = makeGraphMock({
      Function: [{ path: 'src/a.ts', name: 'foo', description: null, startLine: 2, endLine: 4 }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    await makeService(mocks).runEmbedIndex('repo-1');
    const embedArg = (mocks.provider.embed as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(embedArg).toContain('function foo(param: string)');
    expect(mocks.fileContent.getFileContentSafe).toHaveBeenCalledWith('repo-1', 'src/a.ts');
  });

  it('falls back to name+path when file content returns null', async () => {
    const mocks = makeServiceMocks();
    mocks.fileContent.getFileContentSafe.mockResolvedValue(null);
    const graph = makeGraphMock({
      Function: [{ path: 'src/a.ts', name: 'bar', description: 'desc', startLine: 1, endLine: 5 }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    await makeService(mocks).runEmbedIndex('repo-1');
    const embedArg = (mocks.provider.embed as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(embedArg).toContain('bar');
    expect(embedArg).toContain('src/a.ts');
  });

  // ── Component nodes ───────────────────────────────────────────────────────

  it('embeds Component nodes', async () => {
    const mocks = makeServiceMocks();
    const graph = makeGraphMock({
      Component: [{ name: 'Button', description: 'primary button' }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.indexed).toBe(1);
    expect(mocks.provider.embed).toHaveBeenCalledWith('Button primary button');
  });

  // ── Document nodes ────────────────────────────────────────────────────────

  it('embeds Document nodes with chunkText', async () => {
    const mocks = makeServiceMocks();
    const graph = makeGraphMock({
      Document: [{
        path: 'docs/api.md', chunkIndex: 0, heading: 'API', chunkText: 'This is the API docs chunk text.',
      }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.indexed).toBe(1);
    expect(mocks.provider.embed).toHaveBeenCalledWith(
      expect.stringContaining('API'),
    );
  });

  it('skips Document node when text is too short (< 20 chars)', async () => {
    const mocks = makeServiceMocks();
    const graph = makeGraphMock({
      Document: [{ path: 'docs/x.md', chunkIndex: 0, heading: '', chunkText: 'short' }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.indexed).toBe(0);
    expect(mocks.provider.embed).not.toHaveBeenCalled();
  });

  // ── Model / Enum nodes ────────────────────────────────────────────────────

  it('embeds Model nodes', async () => {
    const mocks = makeServiceMocks();
    const graph = makeGraphMock({
      Model: [{
        path: 'prisma/schema.prisma', name: 'User', description: 'app user', fieldSummary: 'id,email', source: 'prisma',
      }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.indexed).toBe(1);
    expect(mocks.provider.embed).toHaveBeenCalledWith(expect.stringContaining('User'));
  });

  it('embeds Enum nodes', async () => {
    const mocks = makeServiceMocks();
    const graph = makeGraphMock({
      Enum: [{ path: 'prisma/schema.prisma', name: 'Role', description: 'user role enum' }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.indexed).toBe(1);
  });

  // ── error isolation ───────────────────────────────────────────────────────

  it('continues indexing when embed throws on one node, counts it as error', async () => {
    const failEmbed = vi
      .fn()
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValue(makeVec(4));
    const mocks = makeServiceMocks({ provider: makeEmbedProvider(4, failEmbed) });
    const graph = makeGraphMock({
      Function: [
        { path: 'src/a.ts', name: 'fail', description: null, startLine: null, endLine: null },
        { path: 'src/b.ts', name: 'ok', description: null, startLine: null, endLine: null },
      ],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.errors).toBe(1);
    expect(result.indexed).toBe(1);
  });

  // ── multiple nodes across all labels ─────────────────────────────────────

  it('aggregates indexed count across Function + Component + Document', async () => {
    const mocks = makeServiceMocks();
    const graph = makeGraphMock({
      Function: [{ path: 'f.ts', name: 'fn', description: null, startLine: null, endLine: null }],
      Component: [{ name: 'Card', description: 'a card' }],
      Document: [{ path: 'doc.md', chunkIndex: 0, heading: 'H', chunkText: 'This is a long enough chunk text for embedding.' }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.indexed).toBe(3);
    expect(result.errors).toBe(0);
  });

  // ── vector index creation ─────────────────────────────────────────────────

  it('creates a vector index for each embeddable label after embedding', async () => {
    const mocks = makeServiceMocks();
    const graph = makeGraphMock();
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    await makeService(mocks).runEmbedIndex('repo-1');
    const indexCalls = (graph.query as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([cypher]) => typeof cypher === 'string' && cypher.includes('CREATE VECTOR INDEX'),
    );
    expect(indexCalls.length).toBeGreaterThanOrEqual(7);
  });

  // ── multi-project fallback ────────────────────────────────────────────────

  it('falls back to [repositoryId] when getProjectIdsForRepo returns []', async () => {
    const mocks = makeServiceMocks({ repoProjectIds: [] });
    const graph = makeGraphMock();
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    await makeService(mocks).runEmbedIndex('repo-1');
    expect(mocks.spaces.getWriteBindingForRepository).toHaveBeenCalledWith('repo-1');
  });

  it('iterates each project id returned by getProjectIdsForRepo', async () => {
    const mocks = makeServiceMocks({ repoProjectIds: ['proj-a', 'proj-b'] });
    const graph = makeGraphMock();
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    await makeService(mocks).runEmbedIndex('repo-1');
    expect(mocks.spaces.getWriteBindingForRepository).toHaveBeenCalledTimes(2);
  });

  // ── embedBatch path ───────────────────────────────────────────────────────

  it('uses embedBatch when provider exposes it', async () => {
    const batchFn = vi.fn().mockResolvedValue([makeVec(4), makeVec(4)]);
    const provider = {
      embed: vi.fn(),
      embedBatch: batchFn,
      getDimension: vi.fn(() => 4),
      isAvailable: vi.fn(() => true),
      id: 'test',
    };
    const mocks = makeServiceMocks({ provider });
    const graph = makeGraphMock({
      Function: [
        { path: 'src/a.ts', name: 'fn1', description: null, startLine: null, endLine: null },
        { path: 'src/a.ts', name: 'fn2', description: null, startLine: null, endLine: null },
      ],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.indexed).toBe(2);
    expect(batchFn).toHaveBeenCalledTimes(1); // both texts in one call
    expect(provider.embed).not.toHaveBeenCalled();
  });

  it('sends one UNWIND write query per batchSize chunk, not one per node', async () => {
    process.env.EMBED_INDEX_BATCH_SIZE = '2';
    const batchFn = vi.fn()
      .mockResolvedValueOnce([makeVec(4), makeVec(4)])
      .mockResolvedValueOnce([makeVec(4)]);
    const provider = {
      embed: vi.fn(),
      embedBatch: batchFn,
      getDimension: vi.fn(() => 4),
      isAvailable: vi.fn(() => true),
      id: 'test',
    };
    const mocks = makeServiceMocks({ provider });
    const graph = makeGraphMock({
      Function: [
        { path: 'a.ts', name: 'f1', description: null, startLine: null, endLine: null },
        { path: 'a.ts', name: 'f2', description: null, startLine: null, endLine: null },
        { path: 'a.ts', name: 'f3', description: null, startLine: null, endLine: null },
      ],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    await makeService(mocks).runEmbedIndex('repo-1');
    const unwindCalls = (graph.query as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([cypher]) => typeof cypher === 'string' && cypher.includes('UNWIND'),
    );
    // 3 nodes with batchSize=2 → 2 UNWIND writes, not 3 individual
    expect(unwindCalls.length).toBe(2);
    delete process.env.EMBED_INDEX_BATCH_SIZE;
  });

  it('file content cache: reads file once for multiple functions in same path', async () => {
    const mocks = makeServiceMocks();
    const fileLines = Array.from({ length: 50 }, (_, i) => `line${i}: ${'x'.repeat(20)}`).join('\n');
    mocks.fileContent.getFileContentSafe.mockResolvedValue(fileLines);
    const graph = makeGraphMock({
      Function: [
        { path: 'src/shared.ts', name: 'fn1', description: null, startLine: 1, endLine: 5 },
        { path: 'src/shared.ts', name: 'fn2', description: null, startLine: 6, endLine: 10 },
        { path: 'src/shared.ts', name: 'fn3', description: null, startLine: 11, endLine: 15 },
      ],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    await makeService(mocks).runEmbedIndex('repo-1');
    // File should be read only once despite 3 functions using the same path
    expect(mocks.fileContent.getFileContentSafe).toHaveBeenCalledTimes(1);
    expect(mocks.fileContent.getFileContentSafe).toHaveBeenCalledWith('repo-1', 'src/shared.ts');
  });

  it('reads file again when Function path changes', async () => {
    const mocks = makeServiceMocks();
    const fileLines = Array.from({ length: 50 }, (_, i) => `line${i}: ${'x'.repeat(20)}`).join('\n');
    mocks.fileContent.getFileContentSafe.mockResolvedValue(fileLines);
    const graph = makeGraphMock({
      Function: [
        { path: 'src/a.ts', name: 'fn1', description: null, startLine: 1, endLine: 5 },
        { path: 'src/b.ts', name: 'fn2', description: null, startLine: 1, endLine: 5 },
      ],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    await makeService(mocks).runEmbedIndex('repo-1');
    expect(mocks.fileContent.getFileContentSafe).toHaveBeenCalledTimes(2);
  });

  it('respects EMBED_INDEX_CONCURRENCY env', async () => {
    process.env.EMBED_INDEX_CONCURRENCY = '20';
    const mocks = makeServiceMocks();
    const graph = makeGraphMock({
      Function: [{ path: 'a.ts', name: 'fn', description: null, startLine: null, endLine: null }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));
    // Should not throw — just verifying the env is read without error
    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result.indexed).toBe(1);
    delete process.env.EMBED_INDEX_CONCURRENCY;
  });

  // ── vecf32 probe: invalid dimension skips embedding ───────────────────────

  it('skips embedding when getDimension returns 0', async () => {
    const provider = { ...makeEmbedProvider(0), getDimension: vi.fn(() => 0) };
    const mocks = makeServiceMocks({ provider });
    const graph = makeGraphMock({
      Function: [{ path: 'src/a.ts', name: 'foo', description: null, startLine: null, endLine: null }],
    });
    FalkorDBMock.connect.mockResolvedValue(makeClientMock(graph));

    const result = await makeService(mocks).runEmbedIndex('repo-1');
    expect(result).toEqual({ indexed: 0, errors: 0 });
    expect(provider.embed).not.toHaveBeenCalled();
  });
});
