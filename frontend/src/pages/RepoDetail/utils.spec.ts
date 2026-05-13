import { describe, it, expect } from 'vitest';
import { formatJobPayload } from './utils';

describe('formatJobPayload', () => {
  it('devuelve — sin payload', () => {
    expect(formatJobPayload(null)).toBe('—');
    expect(formatJobPayload(undefined)).toBe('—');
  });

  it('muestra paso 1 en cola', () => {
    expect(formatJobPayload({ phase: 'queued' }, 'queued')).toContain('Paso 1');
  });

  it('running indexing muestra paso 3 y contador', () => {
    const s = formatJobPayload(
      { phase: 'indexing', current: 10, total: 99 },
      'running',
    );
    expect(s).toContain('Paso 3');
    expect(s).toContain('Indexando');
    expect(s).toContain('10/99');
  });

  it('resume indexados y commit', () => {
    const s = formatJobPayload(
      { indexed: 10, total: 10, commitSha: 'abcdef1234567890' },
      'completed',
    );
    expect(s).toContain('10');
    expect(s).toContain('indexados');
    expect(s).toContain('@abcdef1');
  });
});
