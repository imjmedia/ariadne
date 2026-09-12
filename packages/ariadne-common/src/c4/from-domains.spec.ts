import { describe, expect, it } from 'vitest';
import { domainContextSpecToC4Model } from './from-domains.js';

describe('domainContextSpecToC4Model', () => {
  it('crea sistema principal, externos por whitelist y relaciones con protocolo', () => {
    const model = domainContextSpecToC4Model({
      projectId: 'proj-1',
      projectName: 'Checkout',
      domain: { id: 'dom-a', name: 'Commerce', description: 'Ventas' },
      repos: [{ id: 'repo-11111111-aaaa-bbbb-cccc-dddddddddddd', label: 'checkout-api' }],
      dependencies: [
        {
          dependencyId: 'dep-1',
          domainId: 'dom-b',
          domainName: 'Payments',
          connectionType: 'REST',
          description: 'Cobros',
        },
      ],
      visibilityEdges: [
        {
          edgeId: 'vis-1',
          toDomainId: 'dom-c',
          toDomainName: 'Identity',
          description: 'SSO compartido',
        },
      ],
    });

    expect(model.level).toBe('context');
    expect(model.generator).toBe('sync');
    const systems = model.elements.filter((e) => e.kind === 'system');
    const externals = model.elements.filter((e) => e.kind === 'external');
    expect(systems).toHaveLength(1);
    expect(systems[0]?.name).toBe('checkout-api');
    expect(externals.map((e) => e.name).sort()).toEqual(['Identity', 'Payments']);

    const payRel = model.relationships.find((r) => r.protocol === 'REST');
    expect(payRel?.from).toBe(systems[0]?.id);
    expect(payRel?.label).toBe('Cobros');
    expect(model.elements.every((e) => e.evidence.length >= 1)).toBe(true);
  });

  it('usa un solo sistema cuando no hay repos (mono-root implícito)', () => {
    const model = domainContextSpecToC4Model({
      projectId: 'proj-2',
      projectName: 'Legacy App',
      repos: [],
      dependencies: [],
      visibilityEdges: [],
    });
    expect(model.elements.filter((e) => e.kind === 'system')).toHaveLength(1);
    expect(model.elements[0]?.name).toBe('Legacy App');
  });
});
