import { describe, expect, it } from 'vitest';
import { loadSupplementaryDocExcerpts } from './mdd-supplementary-docs.util';

describe('loadSupplementaryDocExcerpts', () => {
  it('carga extracto y marca truncado', async () => {
    const long = 'x'.repeat(100);
    const rows = await loadSupplementaryDocExcerpts(
      ['INVENTARIO.md'],
      async () => long,
      { maxDocs: 2, maxCharsPerDoc: 40 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.path).toBe('INVENTARIO.md');
    expect(rows[0]!.truncated).toBe(true);
    expect(rows[0]!.total_chars).toBe(100);
    expect(rows[0]!.excerpt).toMatch(/extracto truncado/);
  });

  it('omite paths sin contenido', async () => {
    const rows = await loadSupplementaryDocExcerpts(['missing.md'], async () => null);
    expect(rows).toHaveLength(0);
  });
});
