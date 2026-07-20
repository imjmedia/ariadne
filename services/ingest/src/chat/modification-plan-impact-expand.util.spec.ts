import { describe, it, expect } from 'vitest';
import {
  applyDependentBoost,
  mergeImpactExpandedFiles,
  suggestPhaseForRank,
} from './modification-plan-impact-expand.util';

describe('modification-plan-impact-expand', () => {
  it('keeps seeds and ranks expanded neighbors lower', () => {
    const ranked = mergeImpactExpandedFiles(
      [{ path: 'src/a.ts', repoId: 'r1' }],
      [
        { path: 'src/b.ts', repoId: 'r1', hopBonus: 80 },
        { path: 'src/a.ts', repoId: 'r1', hopBonus: 50 },
      ],
      { maxFiles: 10 },
    );
    expect(ranked[0]?.path).toBe('src/a.ts');
    expect(ranked[0]!.impactScore).toBeGreaterThan(ranked[1]!.impactScore);
    expect(ranked.map((r) => r.path)).toContain('src/b.ts');
  });

  it('boosts by dependent counts', () => {
    const base = mergeImpactExpandedFiles(
      [
        { path: 'src/hot.ts', repoId: 'r1' },
        { path: 'src/cold.ts', repoId: 'r1' },
      ],
      [],
    );
    const counts = new Map([['src/hot.ts', 20]]);
    const boosted = applyDependentBoost(base, counts);
    expect(boosted[0]?.path).toBe('src/hot.ts');
  });

  it('suggests phase thirds', () => {
    expect(suggestPhaseForRank(0, 9)).toBe('1-core');
    expect(suggestPhaseForRank(3, 9)).toBe('2-integrate');
    expect(suggestPhaseForRank(8, 9)).toBe('3-validate');
  });
});
