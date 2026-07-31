import { describe, expect, it } from 'vitest';
import type { ParsedIntegrationHandoff } from './integration-handoff-message.util.js';
import {
  buildIntegrationHandoffSearchQueries,
  mergeIntegrationHandoffFileCandidates,
  scoreIntegrationHandoffFile,
} from './integration-handoff-plan.util.js';

const PARSED: ParsedIntegrationHandoff = {
  handoffId: 'NEW-LEG-04',
  title: 'Visualización de costos asociados en el previsualizador de medios del catálogo',
  sourceProject: 'Micro Servicio de costos',
  actor: 'Ejecutivo',
  description:
    'Cuando abro el previsualizador de un medio desde el catálogo, necesito ver el listado de costos asociados como en la pauta.',
  acceptanceCriteria: ['Solo nombres sin montos', 'Solo desde catálogo'],
};

describe('buildIntegrationHandoffSearchQueries', () => {
  it('includes catalog preview and cost queries', () => {
    const qs = buildIntegrationHandoffSearchQueries(PARSED, PARSED.description);
    const joined = qs.join(' ').toLowerCase();
    expect(joined).toMatch(/catalogo|catálogo/);
    expect(joined).toMatch(/costos/);
    expect(qs.length).toBeGreaterThanOrEqual(3);
  });
});

describe('mergeIntegrationHandoffFileCandidates', () => {
  it('prefers catalog/preview paths over truck-only module for catalog handoffs', () => {
    const camiones = [
      { path: 'src/pages/DataCamiones/components/modals/Foo.tsx', repoId: 'r1' },
      { path: 'src/pages/DataCamiones/DataCamiones.tsx', repoId: 'r1' },
    ];
    const catalog = [
      { path: 'src/pages/Catalogo/MedioPreviewModal.tsx', repoId: 'r1' },
      { path: 'src/pages/Pauta/CostosAsociadosList.tsx', repoId: 'r1' },
    ];
    const merged = mergeIntegrationHandoffFileCandidates([camiones, catalog], PARSED, 8);
    const paths = merged.map((f) => f.path);
    expect(paths.some((p) => /Catalogo|MedioPreview/i.test(p))).toBe(true);
    expect(scoreIntegrationHandoffFile('src/pages/DataCamiones/Foo.tsx', 2, PARSED)).toBeLessThan(
      scoreIntegrationHandoffFile('src/pages/Catalogo/MedioPreviewModal.tsx', 1, PARSED),
    );
  });
});
