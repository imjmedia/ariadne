import { describe, expect, it } from 'vitest';
import { collectStrapiContentTypeRelations } from './strapi-content-type-relations-collect';
import type { ParsedFile } from './parser';

describe('strapi-content-type-relations', () => {
  it('collectStrapiContentTypeRelations extrae targets relation', () => {
    const parsed: ParsedFile[] = [
      {
        path: 'src/api/id-campania/content-types/id-campania/schema.json',
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
            name: 'id-campania',
            apiName: 'id-campania',
            strapiUid: 'api::id-campania.id-campania',
            attributes: [
              {
                name: 'user',
                type: 'relation',
                relation: 'oneToOne',
                target: 'plugin::users-permissions.user',
              },
            ],
          },
        ],
        strapiControllers: [],
        strapiServices: [],
        strapiRoutes: [],
        apiClientReferences: [],
        routes: [],
        models: [],
        domainConcepts: [],
      },
    ];

    const edges = collectStrapiContentTypeRelations(parsed);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.targetUid).toBe('plugin::users-permissions.user');
    expect(edges[0]?.attribute).toBe('user');
  });
});
