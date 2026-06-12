import { describe, expect, it } from 'vitest';
import {
  collectFrontendBusinessLogicFromEvidencePaths,
  inferFrontendMddFromEvidencePaths,
  isFrontendApiModulePath,
} from './mdd-frontend-path-fallback';

describe('mdd-frontend-path-fallback', () => {
  it('detecta módulos api flat y queries sin leer disco', () => {
    expect(isFrontendApiModulePath('src/api/CampaniaQuerys.tsx')).toBe(true);
    expect(isFrontendApiModulePath('src/api/queries/SitiosQueries.tsx')).toBe(true);
    expect(isFrontendApiModulePath('src/api/agencia/services/agencia.js')).toBe(false);

    const bl = collectFrontendBusinessLogicFromEvidencePaths(
      ['src/api/CampaniaQuerys.tsx', 'src/api/queries/SitiosQueries.tsx', 'src/api/UbicacionConfig.tsx'],
      50,
    );
    expect(bl.length).toBe(3);
    expect(bl.find((b) => b.service === 'frontend:CampaniaQuerys')?.dependencies[0]).toContain(
      'CampaniaQuerys',
    );
  });

  it('infiere entidades TS y contratos apiDirection desde evidence_paths', async () => {
    const files: Record<string, string> = {
      'src/Models/CampaniaModel.tsx': `export interface CampaniaModel {
  id?: number;
  nombre?: string;
  estatus?: string;
}`,
      'src/api/CampaniaQuerys.tsx': `/** api/campanias */
export const X = { apiDirection: 'api/campanias', method: 'GET' };`,
      'src/api/queries/SitiosQueries.tsx': `export const Y = { apiDirection: 'api/sitios', method: 'GET' };`,
      'src/pages/Calendario/calendario.tsx': `queryApi({ apiDirection: 'api/campanias', method: 'GET' });`,
    };

    const out = await inferFrontendMddFromEvidencePaths({
      evidencePaths: Object.keys(files),
      getFileSnippet: async (p) => files[p] ?? null,
      maxEntities: 50,
      maxRoutes: 100,
    });

    expect(out.usedFallback).toBe(true);
    expect(out.entities.some((e) => e.name === 'CampaniaModel' && e.source === 'frontend')).toBe(true);
    expect(out.api_contracts.some((c) => c.route === '/api/campanias')).toBe(true);
    expect(out.business_logic.some((b) => b.service === 'frontend:CampaniaQuerys')).toBe(true);
    expect(out.business_logic.some((b) => b.service === 'frontend:SitiosQueries')).toBe(true);
  });
});
