import { describe, expect, it } from 'vitest';
import { fixArchifyArchitectureIr, fixArchifySequenceIr } from './c4-archify-ir-fix';

describe('c4-archify-ir-fix', () => {
  it('acorta label org/repo para Archify context', () => {
    const out = fixArchifyArchitectureIr({
      schema_version: 1,
      diagram_type: 'architecture',
      meta: { title: 'T' },
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
    expect(out.components[0]?.label).toBe('memoria-generacional');
    expect(out.components[0]?.sublabel).toContain('kreodevs/memoria-generacional');
  });

  it('elimina mensaje sequence from===to', () => {
    const out = fixArchifySequenceIr({
      schema_version: 1,
      diagram_type: 'sequence',
      meta: { title: 'T' },
      participants: [
        { id: 'web', type: 'frontend', label: 'Web' },
        { id: 'api', type: 'backend', label: 'API' },
      ],
      messages: [
        { from: 'web', to: 'web', y: 228, label: 'render Screen' },
        { from: 'web', to: 'api', y: 276, label: 'GET /api' },
      ],
    });
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0]?.label).toBe('GET /api');
  });
});
