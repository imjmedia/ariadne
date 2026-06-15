import { describe, expect, it } from 'vitest';
import {
  unusedCustomStrapiRoutesCypher,
  coreRouterStrapiRoutesCountCypher,
} from './chat-unused-api-endpoints.util';

describe('chat-unused-api-endpoints cypher', () => {
  it('unusedCustom excludes core_router and publicRoute', () => {
    const cypher = unusedCustomStrapiRoutesCypher(100);
    expect(cypher).toContain("sr.routeSource <> 'core_router'");
    expect(cypher).toContain('publicRoute');
    expect(cypher).toContain('INVOKES_STRAPI_ROUTE');
    expect(cypher).toContain('ExternalApiReference');
    expect(cypher).toContain('isDynamic');
  });

  it('coreRouter count cypher', () => {
    expect(coreRouterStrapiRoutesCountCypher()).toContain('core_router');
  });
});
