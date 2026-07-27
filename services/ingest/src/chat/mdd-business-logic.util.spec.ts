import { describe, expect, it } from 'vitest';
import { enrichBusinessLogicFromEvidencePaths } from './mdd-business-logic.util';

describe('mdd-business-logic.util', () => {
  it('merges strapi and frontend services when both evidence kinds exist', () => {
    const evidence = [
      'src/api/CampaniaQuerys.tsx',
      'src/api/queries/SitiosQueries.tsx',
      'src/api/campania/services/campania.js',
    ];
    const out = enrichBusinessLogicFromEvidencePaths([], evidence, {
      hasStrapiEvidencePaths: true,
      hasFrontendEvidencePaths: true,
      maxServices: 100,
    });
    expect(out.some((b) => b.service === 'frontend:CampaniaQuerys')).toBe(true);
    expect(out.some((b) => b.service === 'strapi:campania')).toBe(true);
  });

  it('preserves existing graph entries and dedupes by service', () => {
    const out = enrichBusinessLogicFromEvidencePaths(
      [{ service: 'strapi:campania', dependencies: ['src/api/campania/services/campania.js'] }],
      ['src/api/campania/services/campania.js', 'src/api/CampaniaQuerys.tsx'],
      {
        hasStrapiEvidencePaths: true,
        hasFrontendEvidencePaths: true,
        maxServices: 50,
      },
    );
    expect(out.filter((b) => b.service === 'strapi:campania')).toHaveLength(1);
    expect(out.some((b) => b.service === 'frontend:CampaniaQuerys')).toBe(true);
  });
});
