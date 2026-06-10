import { describe, expect, it } from 'vitest';
import {
  enrichParsedFilesWithCoreRouterRoutes,
  inferCoreRestRoutes,
  parseCreateCoreRouterUid,
} from './strapi-core-router-infer';
import type { ParsedFile } from './parser';

describe('strapi-core-router-infer', () => {
  it('parseCreateCoreRouterUid extrae UID', () => {
    const uid = parseCreateCoreRouterUid(
      "module.exports = createCoreRouter('api::campania.campania');",
    );
    expect(uid).toBe('api::campania.campania');
  });

  it('inferCoreRestRoutes genera 5 métodos REST', () => {
    const routes = inferCoreRestRoutes(
      'api::campania.campania',
      { pluralName: 'campanias', apiName: 'campania', name: 'campania' },
      'campania',
    );
    expect(routes).toHaveLength(5);
    expect(routes.map((r) => r.method)).toEqual(['GET', 'GET', 'POST', 'PUT', 'DELETE']);
    expect(routes[0]?.path).toBe('/campanias');
    expect(routes[0]?.routeSource).toBe('core_router');
  });

  it('enrichParsedFilesWithCoreRouterRoutes añade rutas al parsed', async () => {
    const map = new Map<string, ParsedFile>();
    const routePath = 'src/api/campania/routes/campania.js';
    map.set(routePath, {
      path: routePath,
      imports: [],
      components: [],
      hooksUsed: [],
      hooksDefined: [],
      contexts: [],
      renders: [],
      propsByComponent: {},
      functions: [],
      calls: [],
      unresolvedCalls: [],
      nestModules: [],
      nestControllers: [],
      nestHttpRoutes: [],
      nestServices: [],
      strapiContentTypes: [
        {
          name: 'campania',
          apiName: 'campania',
          pluralName: 'campanias',
          strapiUid: 'api::campania.campania',
          attributes: [],
        },
      ],
      strapiControllers: [],
      strapiServices: [],
      strapiRoutes: [],
      apiClientReferences: [],
      routes: [],
      models: [],
      domainConcepts: [],
    });
    map.set('src/api/campania/content-types/campania/schema.json', map.get(routePath)!);

    await enrichParsedFilesWithCoreRouterRoutes(
      map,
      async () => "module.exports = createCoreRouter('api::campania.campania');",
      [map.get(routePath)!],
    );

    expect(map.get(routePath)?.strapiRoutes?.length).toBe(5);
  });
});
