import { describe, expect, it } from 'vitest';
import {
  unusedCustomStrapiRoutesCypher,
  coreRouterStrapiRoutesCountCypher,
} from './chat-unused-api-endpoints.util';

describe('chat-unused-api-endpoints cypher', () => {
  it('unusedCustom excludes core_router, graphql and admin', () => {
    const cypher = unusedCustomStrapiRoutesCypher(100);
    expect(cypher).toContain("sr.routeSource <> 'core_router'");
    expect(cypher).toContain('RESOLVES_TO_ROUTE');
    expect(cypher).toContain('GraphQlClientReference');
    expect(cypher).toContain('strapi_admin');
  });

  it('coreRouter count cypher', () => {
    expect(coreRouterStrapiRoutesCountCypher()).toContain('core_router');
  });
});
