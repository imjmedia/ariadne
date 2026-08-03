import { describe, expect, it } from 'vitest';
import {
  FORGE_PROMOTION_PHASE_PERCENT,
  forgePromotionProgressPatch,
  isKnownForgePromotionPhase,
} from './forge-promotion-progress.util';

describe('forge-promotion-progress.util', () => {
  it('maps phases to monotonic percents', () => {
    expect(FORGE_PROMOTION_PHASE_PERCENT.pack_resolve).toBeLessThan(
      FORGE_PROMOTION_PHASE_PERCENT.pack_enrich,
    );
    expect(FORGE_PROMOTION_PHASE_PERCENT.pack_enrich).toBeLessThan(
      FORGE_PROMOTION_PHASE_PERCENT.forge_create,
    );
    expect(FORGE_PROMOTION_PHASE_PERCENT.forge_create).toBeLessThan(
      FORGE_PROMOTION_PHASE_PERCENT.done,
    );
  });

  it('builds entity patch from phase', () => {
    expect(forgePromotionProgressPatch('forge_create')).toEqual({
      forgePromotionPhase: 'forge_create',
      forgePromotionPercent: 95,
    });
  });

  it('recognizes known phases', () => {
    expect(isKnownForgePromotionPhase('pack_enrich')).toBe(true);
    expect(isKnownForgePromotionPhase('unknown')).toBe(false);
    expect(isKnownForgePromotionPhase(null)).toBe(false);
  });
});
