import { describe, expect, it } from 'vitest';
import { sanitizeArchifySequenceIr } from './archify-ir-sanitize.js';

describe('sanitizeArchifySequenceIr', () => {
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
