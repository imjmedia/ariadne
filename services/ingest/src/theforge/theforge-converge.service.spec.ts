import { describe, expect, it } from 'vitest';
import {
  normalizeTheForgeConvergeTriggerMode,
  shouldTriggerTheForgeConverge,
} from './theforge-converge.service';

describe('theforge-converge helpers', () => {
  it('normalizes invalid mode to off', () => {
    expect(normalizeTheForgeConvergeTriggerMode('bogus')).toBe('off');
    expect(normalizeTheForgeConvergeTriggerMode('incremental')).toBe('incremental');
  });

  it('shouldTrigger respects mode', () => {
    expect(shouldTriggerTheForgeConverge('off', 'full')).toBe(false);
    expect(shouldTriggerTheForgeConverge('full', 'full')).toBe(true);
    expect(shouldTriggerTheForgeConverge('full', 'incremental')).toBe(false);
    expect(shouldTriggerTheForgeConverge('incremental', 'incremental')).toBe(true);
    expect(shouldTriggerTheForgeConverge('all', 'incremental')).toBe(true);
    expect(shouldTriggerTheForgeConverge('all', 'full')).toBe(true);
  });
});
