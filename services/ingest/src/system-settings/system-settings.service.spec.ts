import { describe, expect, it } from 'vitest';
import { buildSystemSettingsFromEnv } from './system-settings.defaults';

describe('buildSystemSettingsFromEnv', () => {
  it('provides product defaults when env is empty', () => {
    const prev = { ...process.env };
    for (const key of [
      'CORS_ORIGIN',
      'SMTP_HOST',
      'FALKOR_SHARD_BY_PROJECT',
      'METRICS_ENABLED',
      'CHAT_TWO_PHASE',
      'MODIFICATION_PLAN_MAX_FILES',
    ]) {
      delete process.env[key];
    }
    const cfg = buildSystemSettingsFromEnv();
    expect(cfg.chat.twoPhase).toBe(true);
    expect(cfg.chat.modificationPlanMaxFiles).toBe(150);
    expect(cfg.observability.metricsEnabled).toBe(true);
    expect(cfg.falkor.graphNodeSoftLimit).toBe(100_000);
    process.env = prev;
  });
});
