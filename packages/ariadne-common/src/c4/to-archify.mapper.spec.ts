import { describe, expect, it } from 'vitest';
import { c4ModelToArchifyArchitecture } from './to-archify.mapper.js';
import { falkorSubgraphToC4ComponentModel } from './from-falkor.components.js';
import { infrastructureSpecToC4Model } from './from-infrastructure.js';
import { domainContextSpecToC4Model } from './from-domains.js';

describe('c4ModelToArchifyArchitecture', () => {
  it('mapea containers a IR Archify v2.9 con pos/size', () => {
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
    expect(ir).not.toHaveProperty('layout');
    expect('quality_profile' in ir.meta).toBe(false);
    expect(ir.components.length).toBe(2);
    expect(ir.components[0]?.pos).toEqual([40, 80]);
    expect(ir.components[0]?.size).toEqual([130, 60]);
    expect(ir.components.find((c) => c.id.includes('api'))?.type).toBe('backend');
    expect(ir.components.find((c) => c.label === 'postgres')?.type).toBe('database');
    expect(ir.connections?.[0]).not.toHaveProperty('id');
  });

  it('omite label en RENDERS/IMPORTS/CALLS a nivel componente', () => {
    const model = falkorSubgraphToC4ComponentModel({
      projectId: 'p1',
      containerKey: 'web',
      containerName: 'Web',
      pathPrefixes: ['apps/web/'],
      nodes: [
        {
          id: 'Parent::apps/web/a.tsx',
          name: 'Parent',
          filePath: 'apps/web/a.tsx',
          containerKey: 'web',
          nodeKind: 'component',
        },
        {
          id: 'Child::apps/web/b.tsx',
          name: 'Child',
          filePath: 'apps/web/b.tsx',
          containerKey: 'web',
          nodeKind: 'component',
        },
      ],
      edges: [
        {
          id: 'e1',
          fromId: 'Parent::apps/web/a.tsx',
          toId: 'Child::apps/web/b.tsx',
          label: 'renders',
          relType: 'RENDERS',
        },
      ],
    });
    const ir = c4ModelToArchifyArchitecture(model);
    expect(ir.connections?.[0]?.label).toBeUndefined();
    expect(ir.connections?.[0]?.variant).toBe('dashed');
  });

  it('no pone descripciones de inferencia como label en context', () => {
    const model = domainContextSpecToC4Model({
      projectId: 'p1',
      projectName: 'Memoria',
      repos: [{ id: 'repo-11111111-aaaa-bbbb-cccc-dddddddddddd', label: 'memoria-generacional' }],
      dependencies: [
        {
          dependencyId: 'dep-2',
          domainId: 'dom-msg',
          domainName: 'Mensajería',
          connectionType: 'eventos',
          description: 'Bus o cola detectada en package.json (@nestjs/bullmq)',
        },
      ],
      visibilityEdges: [],
    });
    const ir = c4ModelToArchifyArchitecture(model);
    expect(ir.connections?.every((c) => !c.label?.includes('package.json'))).toBe(true);
    expect(ir.connections?.every((c) => !c.label || c.label === 'REST')).toBe(true);
  });

  it('no usa connectionType custom (eventos) como label en context', () => {
    const model = domainContextSpecToC4Model({
      projectId: 'p1',
      projectName: 'Memoria',
      repos: [{ id: 'repo-11111111-aaaa-bbbb-cccc-dddddddddddd', label: 'memoria-generacional' }],
      dependencies: [
        {
          dependencyId: 'dep-1',
          domainId: 'dom-ev',
          domainName: 'Eventos y memorias',
          connectionType: 'eventos',
        },
      ],
      visibilityEdges: [],
    });
    const ir = c4ModelToArchifyArchitecture(model);
    expect(ir.connections?.every((c) => c.label?.toLowerCase() !== 'eventos')).toBe(true);
  });

  it('mapea context sin layout legacy', () => {
    const model = domainContextSpecToC4Model({
      projectId: 'p1',
      projectName: 'Demo',
      repos: [{ id: 'repo-11111111-aaaa-bbbb-cccc-dddddddddddd', label: 'app' }],
      dependencies: [],
      visibilityEdges: [],
    });
    const ir = c4ModelToArchifyArchitecture(model);
    expect(ir.components.every((c) => Array.isArray(c.pos) && c.pos.length === 2)).toBe(true);
    expect(ir.components.every((c) => !('row' in c) && !('col' in c))).toBe(true);
  });
});
