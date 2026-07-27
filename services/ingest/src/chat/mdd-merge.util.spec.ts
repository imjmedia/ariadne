import { describe, expect, it } from 'vitest';
import type { MddEvidenceDocument } from './mdd-document.types';
import { mergeMddEvidenceDocuments, type MddMergeSource } from './mdd-merge.util';

function baseMdd(overrides: Partial<MddEvidenceDocument> = {}): MddEvidenceDocument {
  return {
    summary: 'baseline',
    openapi_spec: { found: false, path: null, trust_level: 'low' },
    entities: [],
    api_contracts: [],
    business_logic: [],
    infrastructure: { orm: 'none', env_vars: [] },
    risk_report: { complexity: 10, anti_patterns: [] },
    evidence_paths: [],
    ...overrides,
  };
}

describe('mdd-merge.util', () => {
  it('returns single source unchanged with multi_root override', () => {
    const src: MddMergeSource = {
      repositoryId: 'a',
      slug: 'org/front',
      fromSnapshot: true,
      mdd: baseMdd({ summary: 'front only' }),
    };
    const multiRoot = {
      projectId: 'p',
      projectName: 'OBP',
      repository_count: 2,
      is_multi_root: true,
      repositories: [],
      mdd_scope_repo_ids: ['a', 'b'],
      cross_repo_links: {
        calls_api: 0,
        calls_strapi_route: 5,
        calls_nest_route: 0,
        calls_graphql_query: 0,
        total: 5,
      },
    };
    const merged = mergeMddEvidenceDocuments([src], multiRoot);
    expect(merged.summary).toBe('front only');
    expect(merged.multi_root?.projectId).toBe('p');
  });

  it('merges entities and api contracts without duplicates', () => {
    const front: MddMergeSource = {
      repositoryId: 'f',
      slug: 'org/front',
      fromSnapshot: false,
      mdd: baseMdd({
        summary: 'front summary',
        entities: [{ name: 'UserModel', source: 'frontend', fields: ['id'] }],
        api_contracts: [{ route: '/api/users', methods: ['GET'], doc_source: 'ast' }],
        evidence_paths: ['src/api/users.ts'],
      }),
    };
    const back: MddMergeSource = {
      repositoryId: 'b',
      slug: 'org/back',
      fromSnapshot: true,
      mdd: baseMdd({
        summary: 'back summary',
        entities: [
          { name: 'User', source: 'strapi', fields: ['id', 'email'] },
          { name: 'UserModel', source: 'frontend', fields: ['id'] },
        ],
        api_contracts: [
          { route: '/api/users', methods: ['GET'], doc_source: 'strapi' },
          { route: '/api/campaigns', methods: ['POST'], doc_source: 'strapi' },
        ],
        infrastructure: { orm: 'strapi', env_vars: ['DATABASE_URL'] },
        risk_report: { complexity: 40, anti_patterns: ['strapi_route_large_surface'] },
        evidence_paths: ['src/api/campaign/routes.js'],
      }),
    };

    const merged = mergeMddEvidenceDocuments([front, back]);
    expect(merged.summary).toContain('MDD fusionado multi-root');
    expect(merged.entities).toHaveLength(2);
    expect(merged.api_contracts).toHaveLength(2);
    expect(merged.infrastructure.orm).toBe('strapi');
    expect(merged.infrastructure.env_vars).toEqual(['DATABASE_URL']);
    expect(merged.risk_report.complexity).toBe(40);
    expect(merged.evidence_paths).toEqual(['src/api/users.ts', 'src/api/campaign/routes.js']);
  });
});
