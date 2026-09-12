import { describe, expect, it } from 'vitest';
import { sanitizeArchifyArchitectureIr, sanitizeArchifySequenceIr } from './archify-ir-sanitize.js';

describe('sanitizeArchifyArchitectureIr', () => {
  it('acorta labels org/repo y ensancha el componente para Archify', () => {
    const out = sanitizeArchifyArchitectureIr({
      schema_version: 1,
      diagram_type: 'architecture',
      meta: { title: 'C4 Context' },
      components: [
        {
          id: 'sys_cc2826e9509a4253',
          type: 'backend',
          label: 'kreodevs/memoria-generacional',
          pos: [40, 80],
          size: [130, 60],
        },
      ],
    });

    const component = out.components[0]!;
    expect(component.label).toBe('memoria-generacional');
    expect(component.sublabel).toContain('kreodevs/memoria-generacional');
    expect(component.size?.[0]).toBeGreaterThanOrEqual(130);
    expect(component.size?.[0]).toBeLessThanOrEqual(280);
  });

  it('ensancha el componente cuando el label no cabe ni tras acortar', () => {
    const out = sanitizeArchifyArchitectureIr({
      schema_version: 1,
      diagram_type: 'architecture',
      meta: { title: 'C4 Context' },
      components: [
        {
          id: 'svc_long',
          type: 'backend',
          label: 'motor-de-costos-y-listas-de-precios-extendido',
          pos: [40, 80],
          size: [130, 60],
        },
      ],
    });

    const component = out.components[0]!;
    expect(component.size?.[0]).toBeGreaterThan(130);
  });
});

describe('sanitizeArchifySequenceIr', () => {
  it('convierte mensajes self-loop en note del siguiente paso saliente', () => {
    const out = sanitizeArchifySequenceIr({
      schema_version: 1,
      diagram_type: 'sequence',
      meta: { title: 'API flow', viewBox: [820, 520] },
      participants: [
        { id: 'user', type: 'external', label: 'Usuario' },
        { id: 'web', type: 'frontend', label: 'Web UI' },
        { id: 'api', type: 'backend', label: 'API Gateway' },
      ],
      messages: [
        { from: 'user', to: 'web', y: 180, label: 'navega' },
        { from: 'web', to: 'web', y: 228, label: 'render Screen' },
        { from: 'web', to: 'api', y: 276, label: 'GET /api' },
      ],
    });

    expect(out.messages).toHaveLength(2);
    expect(out.messages.some((m) => m.from === m.to)).toBe(false);
    expect(out.messages[1]?.note).toContain('render Screen');
  });

  it('elimina quality_profile e id en messages (legacy)', () => {
    const out = sanitizeArchifySequenceIr({
      schema_version: 1,
      diagram_type: 'sequence',
      meta: {
        title: 'Test',
        quality_profile: 'showcase',
        viewBox: [820, 520],
      },
      participants: [
        { id: 'web', type: 'frontend', label: 'Web' },
        { id: 'api', type: 'backend', label: 'API' },
      ],
      messages: [
        {
          id: 'call',
          from: 'web',
          to: 'api',
          y: 200,
          label: 'GET /x',
          variant: 'emphasis',
        },
      ],
    });
    expect('quality_profile' in out.meta).toBe(false);
    expect(out.messages[0]).toEqual({
      from: 'web',
      to: 'api',
      y: 200,
      label: 'GET /x',
      variant: 'emphasis',
    });
  });
});
