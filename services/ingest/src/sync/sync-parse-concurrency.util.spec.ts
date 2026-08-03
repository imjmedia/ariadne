import { afterEach, describe, expect, it } from 'vitest';
import { syncParseConcurrencyFromEnv } from './sync-parse-concurrency.util';

describe('syncParseConcurrencyFromEnv', () => {
  afterEach(() => {
    delete process.env.SYNC_PARSE_CONCURRENCY;
  });

  it('defaults to 4 when unset', () => {
    expect(syncParseConcurrencyFromEnv()).toBe(4);
  });

  it('respects SYNC_PARSE_CONCURRENCY', () => {
    process.env.SYNC_PARSE_CONCURRENCY = '8';
    expect(syncParseConcurrencyFromEnv()).toBe(8);
  });

  it('falls back to 4 for invalid values', () => {
    process.env.SYNC_PARSE_CONCURRENCY = '0';
    expect(syncParseConcurrencyFromEnv()).toBe(4);
  });

  it('caps at 32', () => {
    process.env.SYNC_PARSE_CONCURRENCY = '100';
    expect(syncParseConcurrencyFromEnv()).toBe(32);
  });
});
