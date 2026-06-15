import { describe, expect, it } from 'vitest';
import {
  buildCrossRepoApiAndStrapiLinkCypher,
  buildGraphQlAdminOnlyMarkCypher,
  buildPublicEntryReachableApiLinkCypher,
  buildPublicEntryRouteLinkCypher,
} from './cross-repo-api-link';

describe('cross-repo-api-link slice3', () => {
  const pid = 'proj-uuid';

  it('buildGraphQlAdminOnlyMarkCypher marks admin-only queries', () => {
    const stmts = buildGraphQlAdminOnlyMarkCypher(pid);
    expect(stmts.length).toBe(2);
    expect(stmts[0]).toContain('strapi_graphql_admin');
  });

  it('buildPublicEntryRouteLinkCypher links Route to StrapiRoute', () => {
    const stmts = buildPublicEntryRouteLinkCypher(pid);
    expect(stmts[0]).toContain('ENTRY_CONSUMES');
    expect(stmts[0]).toContain('isPublicEntry');
  });

  it('buildPublicEntryReachableApiLinkCypher traverses RENDERS', () => {
    const stmts = buildPublicEntryReachableApiLinkCypher(pid);
    expect(stmts[0]).toContain('ENTRY_REACHES_API');
    expect(stmts[0]).toContain('RENDERS');
  });

  it('buildCrossRepoApiAndStrapiLinkCypher includes slice3 links', () => {
    const stmts = buildCrossRepoApiAndStrapiLinkCypher(pid);
    expect(stmts.length).toBe(17);
    expect(stmts.some((s) => s.includes('ENTRY_CONSUMES'))).toBe(true);
    expect(stmts.some((s) => s.includes('strapi_graphql_admin'))).toBe(true);
    expect(stmts.some((s) => s.includes('CALLS_NEST_ROUTE'))).toBe(true);
  });
});
