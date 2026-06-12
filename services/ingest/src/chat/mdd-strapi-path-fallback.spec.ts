import { describe, expect, it } from 'vitest';
import { inferStrapiMddFromEvidencePaths } from './mdd-strapi-path-fallback';

describe('mdd-strapi-path-fallback', () => {
  it('infiere rutas core REST desde createCoreRouter y custom con config anidado', async () => {
    const files: Record<string, string> = {
      'src/api/campania/content-types/campania/schema.json': JSON.stringify({
        kind: 'collectionType',
        collectionName: 'campanias',
        info: { singularName: 'campania', pluralName: 'campanias', displayName: 'Campania' },
        attributes: { nombre: { type: 'string' } },
      }),
      'src/api/campania/routes/campania.js':
        "module.exports = createCoreRouter('api::campania.campania');",
      'src/api/campania/routes/custom.js': `module.exports = {
        routes: [
          {
            method: 'GET',
            path: '/listaCampania',
            handler: 'campania.listaCampania',
            config: { auth: false },
          },
        ],
      };`,
    };

    const out = await inferStrapiMddFromEvidencePaths({
      evidencePaths: Object.keys(files),
      getFileSnippet: async (p) => files[p] ?? null,
      maxContentTypes: 100,
      maxRoutes: 500,
    });

    expect(out.usedFallback).toBe(true);
    expect(out.entities.some((e) => e.name === 'campania')).toBe(true);
    expect(out.api_contracts.some((c) => c.route === '/campanias' && c.methods.includes('GET'))).toBe(
      true,
    );
    expect(out.api_contracts.some((c) => c.route === '/listaCampania')).toBe(true);
  });
});
