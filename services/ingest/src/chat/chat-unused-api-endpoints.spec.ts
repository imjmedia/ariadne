import { describe, expect, it } from 'vitest';
import {
  unusedCustomStrapiRoutesCypher,
  coreRouterStrapiRoutesCountCypher,
} from './chat-unused-api-endpoints.util';

describe('chat-unused-api-endpoints cypher', () => {
  it('unusedCustom excludes entry public and graphql admin', () => {
    const cypher = unusedCustomStrapiRoutesCypher(100);
    expect(cypher).toContain('ENTRY_CONSUMES');
    expect(cypher).toContain('strapi_admin');
    expect(cypher).toContain('RESOLVES_TO_ROUTE');
  });

  it('coreRouter count cypher', () => {
    expect(coreRouterStrapiRoutesCountCypher()).toContain('core_router');
  });
});
