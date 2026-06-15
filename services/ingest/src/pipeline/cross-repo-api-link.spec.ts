import { describe, expect, it } from 'vitest';
import {
  buildCrossRepoApiAndStrapiLinkCypher,
  buildCrossRepoExternalStrapiRouteLinkCypher,
  buildCrossRepoGraphQlClientLinkCypher,
  buildCrossRepoStrapiRouteLinkCypher,
  buildGraphQlResolvesToRouteLinkCypher,
  buildInternalStrapiRouteLinkCypher,
  buildOpenApiStrapiRouteLinkCypher,
} from './cross-repo-api-link';

describe('cross-repo-api-link', () => {
  const pid = 'proj-uuid';

  it('buildCrossRepoStrapiRouteLinkCypher links StrapiRoute with dynamic prefix', () => {
    const stmts = buildCrossRepoStrapiRouteLinkCypher(pid);
    expect(stmts.length).toBe(1);
    expect(stmts[0]).toContain('StrapiRoute');
    expect(stmts[0]).toContain('CALLS_STRAPI_ROUTE');
    expect(stmts[0]).toContain('isDynamic');
  });

  it('buildCrossRepoExternalStrapiRouteLinkCypher links ExternalApiReference', () => {
    const stmts = buildCrossRepoExternalStrapiRouteLinkCypher(pid);
    expect(stmts.length).toBe(1);
    expect(stmts[0]).toContain('ExternalApiReference');
  });

  it('buildInternalStrapiRouteLinkCypher links lifecycles and uid refs', () => {
    const stmts = buildInternalStrapiRouteLinkCypher(pid);
    expect(stmts.length).toBe(2);
    expect(stmts[0]).toContain('LIFECYCLE_OF');
    expect(stmts[0]).toContain('INVOKES_STRAPI_ROUTE');
    expect(stmts[1]).toContain('REFERENCES_STRAPI_UID');
  });

  it('buildOpenApiStrapiRouteLinkCypher links OpenAPI and front bridge', () => {
    const stmts = buildOpenApiStrapiRouteLinkCypher(pid);
    expect(stmts.length).toBe(2);
    expect(stmts[0]).toContain('SAME_REST_AS');
    expect(stmts[1]).toContain('CALLS_API');
  });

  it('buildGraphQlResolvesToRouteLinkCypher uses resolverAction', () => {
    const stmts = buildGraphQlResolvesToRouteLinkCypher(pid);
    expect(stmts[0]).toContain('RESOLVES_TO_ROUTE');
    expect(stmts[0]).toContain('resolverAction');
  });

  it('buildCrossRepoGraphQlClientLinkCypher links GraphQlClientReference', () => {
    const stmts = buildCrossRepoGraphQlClientLinkCypher(pid);
    expect(stmts.length).toBe(2);
    expect(stmts[0]).toContain('GraphQlClientReference');
    expect(stmts[1]).toContain('CALLS_STRAPI_ROUTE');
  });

  it('buildCrossRepoApiAndStrapiLinkCypher includes all link kinds', () => {
    const stmts = buildCrossRepoApiAndStrapiLinkCypher(pid);
    expect(stmts.length).toBe(14);
    expect(stmts.some((s) => s.includes('OpenApiOperation'))).toBe(true);
    expect(stmts.some((s) => s.includes('ExternalApiReference'))).toBe(true);
    expect(stmts.some((s) => s.includes('INVOKES_STRAPI_ROUTE'))).toBe(true);
    expect(stmts.some((s) => s.includes('SAME_REST_AS'))).toBe(true);
    expect(stmts.some((s) => s.includes('RESOLVES_TO_ROUTE'))).toBe(true);
  });
});
