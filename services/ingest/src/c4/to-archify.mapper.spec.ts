import { describe, expect, it } from 'vitest';
import { c4ModelToArchifyArchitecture, infrastructureSpecToC4Model } from 'ariadne-common';

describe('c4ModelToArchifyArchitecture', () => {
  it('mapea containers a IR Archify con grid', () => {
    const model = infrastructureSpecToC4Model(
      {
        systemName: 'demo/app',
        containers: [
          {
            key: 'api',
            name: 'api',
            pathPrefixes: ['services/api/'],
            technology: 'nest',
            c4Kind: 'software',
          },
          {
            key: 'db',
            name: 'postgres',
            pathPrefixes: [],
            technology: 'postgres:16',
            c4Kind: 'database',
          },
        ],
        communications: [{ fromKey: 'api', toKey: 'db', label: 'SQL' }],
      },
      'proj-1',
      { repoId: 'repo-1' },
    );
    const ir = c4ModelToArchifyArchitecture(model);
    expect(ir.diagram_type).toBe('architecture');
    expect(ir.components[0]?.pos).toBeDefined();
    expect(ir.components.length).toBe(2);
    expect(ir.components.find((c) => c.id.includes('api'))?.type).toBe('backend');
    expect(ir.components.find((c) => c.label === 'postgres')?.type).toBe('database');
  });
});
