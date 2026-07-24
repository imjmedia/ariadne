import { describe, it, expect } from 'vitest';
import { normalizeForgeApiBase } from './forge-http.util';

describe('normalizeForgeApiBase', () => {
  it('rewrites MCP URL to REST /api', () => {
    expect(normalizeForgeApiBase('https://maxprime.obp.mx/mcp')).toBe('https://maxprime.obp.mx/api');
  });

  it('leaves REST base unchanged', () => {
    expect(normalizeForgeApiBase('https://maxprime.obp.mx/api')).toBe('https://maxprime.obp.mx/api');
  });
});
