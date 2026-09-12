import { describe, expect, it } from 'vitest';
import { diffC4Models } from './c4-model.diff.js';
import type { C4Model } from './c4-model.types.js';

function baseModel(): C4Model {
  return {
    schemaVersion: '1.0',
    projectId: 'p1',
    level: 'container',
    generatedAt: '2026-01-01T00:00:00Z',
    generator: 'sync',
    contentHash: 'a',
    elements: [
      { id: 'c1', kind: 'container', name: 'api', evidence: [{ source: 'compose', reason: 'x' }] },
      { id: 'c2', kind: 'container', name: 'db', evidence: [{ source: 'compose', reason: 'x' }] },
    ],
    relationships: [],
  };
}

describe('diffC4Models', () => {
  it('detecta elementos añadidos y eliminados', () => {
    const from = baseModel();
    const to: C4Model = {
      ...from,
      contentHash: 'b',
      elements: [
        { id: 'c1', kind: 'container', name: 'api', evidence: [{ source: 'compose', reason: 'x' }] },
        { id: 'c3', kind: 'container', name: 'worker', evidence: [{ source: 'compose', reason: 'x' }] },
      ],
    };
    const diff = diffC4Models(from, to);
    expect(diff.summary.elementsAdded).toBe(1);
    expect(diff.summary.elementsRemoved).toBe(1);
    expect(diff.elements.find((e) => e.status === 'added')?.name).toBe('worker');
    expect(diff.elements.find((e) => e.status === 'removed')?.name).toBe('db');
  });
});
