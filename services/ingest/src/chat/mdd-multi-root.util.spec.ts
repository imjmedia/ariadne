import { describe, expect, it, vi } from 'vitest';
import {
  buildMddMultiRootBlock,
  buildMddMultiRootNotes,
  buildMddMultiRootRepositories,
  mddSummaryScopeLabel,
} from './mdd-multi-root.util';

describe('mdd-multi-root.util', () => {
  const repos = [
    {
      id: 'front-id',
      projectKey: 'desarrollo_imj',
      repoSlug: 'oohbp2',
      status: 'ready',
      lastSyncAt: '2026-07-24T17:08:34.000Z',
      role: 'frontend',
    },
    {
      id: 'back-id',
      projectKey: 'desarrollo_imj',
      repoSlug: 'erp',
      status: 'ready',
      lastSyncAt: '2026-07-24T17:00:34.000Z',
      role: 'Backend',
    },
  ];

  it('marks multi-root project with scoped primary repo', () => {
    const block = buildMddMultiRootRepositories({
      projectId: 'proj-1',
      projectName: 'OBP',
      repositories: repos,
      mddScopeRepoIds: ['back-id'],
      primaryRepositoryId: 'back-id',
    });
    expect(block).toHaveLength(2);
    expect(block.find((r) => r.repoId === 'back-id')).toMatchObject({
      in_mdd_scope: true,
      is_primary: true,
      slug: 'desarrollo_imj/erp',
      role: 'Backend',
    });
    expect(block.find((r) => r.repoId === 'front-id')).toMatchObject({
      in_mdd_scope: false,
      is_primary: false,
    });
  });

  it('builds notes distinguishing git multi-repo from deploy topology', () => {
    const repositories = buildMddMultiRootRepositories({
      projectId: 'proj-1',
      projectName: 'OBP',
      repositories: repos,
      mddScopeRepoIds: ['back-id'],
      primaryRepositoryId: 'back-id',
    });
    const notes = buildMddMultiRootNotes(repositories, ['back-id'], {
      calls_api: 0,
      calls_strapi_route: 42,
      calls_nest_route: 0,
      calls_graphql_query: 3,
      total: 45,
    });
    expect(notes).toContain('multi-root');
    expect(notes).toContain('desarrollo_imj/oohbp2');
    expect(notes).toContain('45 enlace(s) cross-repo');
    expect(notes).toContain('no implica deploy independiente');
  });

  it('summary scope label reflects scoped repo in multi-root workspace', () => {
    const multiRoot = {
      projectId: 'proj-1',
      projectName: 'OBP',
      repository_count: 2,
      is_multi_root: true,
      repositories: buildMddMultiRootRepositories({
        projectId: 'proj-1',
        projectName: 'OBP',
        repositories: repos,
        mddScopeRepoIds: ['back-id'],
        primaryRepositoryId: 'back-id',
      }),
      mdd_scope_repo_ids: ['back-id'],
      cross_repo_links: {
        calls_api: 0,
        calls_strapi_route: 1,
        calls_nest_route: 0,
        calls_graphql_query: 0,
        total: 1,
      },
    };
    expect(mddSummaryScopeLabel(multiRoot)).toContain('desarrollo_imj/erp');
    expect(mddSummaryScopeLabel(multiRoot)).toContain('multi-root');
  });

  it('counts cross-repo links via cypher executor', async () => {
    const executeCypher = vi.fn(async () => [
      { rel: 'CALLS_STRAPI_ROUTE', c: 10 },
      { rel: 'CALLS_GRAPHQL_QUERY', c: 2 },
    ]);
    const block = await buildMddMultiRootBlock(
      {
        projectId: 'proj-1',
        projectName: 'OBP',
        repositories: repos,
        mddScopeRepoIds: ['back-id'],
        primaryRepositoryId: 'back-id',
      },
      executeCypher,
    );
    expect(block.is_multi_root).toBe(true);
    expect(block.repository_count).toBe(2);
    expect(block.cross_repo_links).toMatchObject({
      calls_strapi_route: 10,
      calls_graphql_query: 2,
      total: 12,
    });
    expect(executeCypher).toHaveBeenCalledWith(
      'proj-1',
      expect.stringContaining('CALLS_STRAPI_ROUTE'),
      { projectId: 'proj-1' },
    );
  });
});
