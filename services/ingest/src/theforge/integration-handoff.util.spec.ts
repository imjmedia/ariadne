import { describe, expect, it } from 'vitest';
import {
  buildHandoffSeedMessage,
  filterSentHandoffs,
  readForgeIntegrationHandoff,
} from './integration-handoff.util';

describe('integration-handoff.util', () => {
  it('parses integrationHandoff items', () => {
    const doc = readForgeIntegrationHandoff({
      integrationHandoff: {
        items: [
          {
            id: 'NEW-LEG-01',
            title: 'Cotizador',
            description: 'Mostrar costos',
            status: 'sent',
            acceptanceCriteria: ['Aparece ícono'],
          },
          { id: 'NEW-LEG-02', title: 'Draft', description: 'x', status: 'draft' },
        ],
      },
    });
    expect(doc?.items).toHaveLength(2);
    expect(filterSentHandoffs(doc!)).toHaveLength(1);
  });

  it('builds seed markdown with acceptance criteria', () => {
    const md = buildHandoffSeedMessage(
      {
        id: 'NEW-LEG-01',
        title: 'Cotizador',
        description: 'Desc',
        acceptanceCriteria: ['Criterio 1'],
      },
      'Micro Servicio',
    );
    expect(md).toContain('NEW-LEG-01');
    expect(md).toContain('Criterio 1');
    expect(md).toContain('brownfield');
  });
});
