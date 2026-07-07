import { describe, expect, it } from 'vitest';
import { getCatalogEntry, getCatalogList, isProviderId } from './llm-catalog';
import { maskApiKeyHint } from './llm-settings.util';

describe('llm-settings util', () => {
  it('maskApiKeyHint masks long keys', () => {
    expect(maskApiKeyHint('sk-or-v1-abcdefghijklmnop')).toBe('sk-o…mnop');
  });

  it('maskApiKeyHint returns null for empty', () => {
    expect(maskApiKeyHint('')).toBeNull();
  });
});

describe('llm-catalog', () => {
  it('lists six providers', () => {
    expect(getCatalogList()).toHaveLength(6);
  });

  it('recognizes openrouter', () => {
    expect(isProviderId('openrouter')).toBe(true);
    expect(getCatalogEntry('openrouter')?.defaultBaseUrl).toContain('openrouter.ai');
  });
});
