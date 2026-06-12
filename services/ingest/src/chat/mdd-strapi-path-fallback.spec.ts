import { describe, expect, it } from 'vitest';
import {
  collectStrapiBusinessLogicFromEvidencePaths,
  inferStrapiMddFromEvidencePaths,
} from './mdd-strapi-path-fallback';

describe('mdd-strapi-path-fallback', () => {
  it('collectStrapiBusinessLogicFromEvidencePaths incluye servicios anidados', () => {
    const bl = collectStrapiBusinessLogicFromEvidencePaths(
      [
        'src/api/agencia/services/agencia.js',
        'src/api/bitacora-cambio-medio/services/bitacora-medios/list-bitacora-medios.js',
      ],
      50,
    );
    expect(bl.some((b) => b.service === 'strapi:agencia')).toBe(true);
    expect(bl.some((b) => b.service === 'strapi:list-bitacora-medios')).toBe(true);
    expect(bl.find((b) => b.service === 'strapi:agencia')?.dependencies).toContain(
      'src/api/agencia/services/agencia.js',
    );
  });

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
