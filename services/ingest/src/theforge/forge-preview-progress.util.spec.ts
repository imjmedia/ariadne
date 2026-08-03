import { describe, expect, it } from 'vitest';
import {
  FORGE_PREVIEW_PHASE_PERCENT,
  forgePreviewMergePercent,
  forgePreviewProgressPatch,
  isKnownForgePreviewPhase,
} from './forge-preview-progress.util';

describe('forge-preview-progress.util', () => {
  it('maps preview phases to ordered percents', () => {
    expect(FORGE_PREVIEW_PHASE_PERCENT.pack_merge).toBeLessThan(
      FORGE_PREVIEW_PHASE_PERCENT.pack_enrich,
    );
    expect(FORGE_PREVIEW_PHASE_PERCENT.pack_enrich).toBeLessThan(
      FORGE_PREVIEW_PHASE_PERCENT.done,
    );
  });

  it('interpolates merge percent by conversation count', () => {
    expect(forgePreviewMergePercent(0, 4)).toBe(15);
    expect(forgePreviewMergePercent(2, 4)).toBe(33);
    expect(forgePreviewMergePercent(4, 4)).toBe(50);
  });

  it('builds entity patch from phase', () => {
    expect(forgePreviewProgressPatch('pack_enrich')).toEqual({
      forgePreviewPhase: 'pack_enrich',
      forgePreviewPercent: 55,
    });
    expect(forgePreviewProgressPatch('pack_merge', 28)).toEqual({
      forgePreviewPhase: 'pack_merge',
      forgePreviewPercent: 28,
    });
  });

  it('recognizes known preview phases', () => {
    expect(isKnownForgePreviewPhase('pack_build')).toBe(true);
    expect(isKnownForgePreviewPhase('unknown')).toBe(false);
  });
});
