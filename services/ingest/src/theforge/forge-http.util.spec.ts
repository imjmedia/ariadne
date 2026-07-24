import { describe, it, expect } from 'vitest';
import {
  collectForgeApiBaseCandidates,
  isLikelyHtmlBody,
  suggestForgeApiUrl,
} from './forge-http.util';

describe('forge-http.util', () => {
  it('detects HTML bodies', () => {
    expect(isLikelyHtmlBody('<!DOCTYPE html><html lang="es">')).toBe(true);
    expect(isLikelyHtmlBody('{"projects":[]}')).toBe(false);
  });

  it('adds /api candidate for SPA root', () => {
    expect(collectForgeApiBaseCandidates('https://maxprime.obp.mx')).toEqual([
      'https://maxprime.obp.mx',
      'https://maxprime.obp.mx/api',
    ]);
  });

  it('strips /mcp and adds /api', () => {
    expect(collectForgeApiBaseCandidates('https://maxprime.obp.mx/mcp')).toEqual([
      'https://maxprime.obp.mx/mcp',
      'https://maxprime.obp.mx',
      'https://maxprime.obp.mx/api',
    ]);
  });

  it('suggests /api base', () => {
    expect(suggestForgeApiUrl('https://maxprime.obp.mx/mcp')).toBe('https://maxprime.obp.mx/api');
  });
});
