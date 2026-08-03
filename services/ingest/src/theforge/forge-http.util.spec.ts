import { describe, it, expect } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  collectForgeApiBaseCandidates,
  formatForgePromotionError,
  isLikelyHtmlBody,
  normalizeForgeApiBase,
  suggestForgeApiUrl,
} from './forge-http.util';

describe('forge-http.util', () => {
  it('detects HTML bodies', () => {
    expect(isLikelyHtmlBody('<!DOCTYPE html><html lang="es">')).toBe(true);
    expect(isLikelyHtmlBody('{"projects":[]}')).toBe(false);
  });

  it('rewrites MCP URL to REST /api', () => {
    expect(normalizeForgeApiBase('https://maxprime.obp.mx/mcp')).toBe('https://maxprime.obp.mx/api');
  });

  it('adds /api candidate for SPA root without probing /mcp', () => {
    expect(collectForgeApiBaseCandidates('https://maxprime.obp.mx')).toEqual([
      'https://maxprime.obp.mx',
      'https://maxprime.obp.mx/api',
    ]);
  });

  it('strips /mcp and adds /api without keeping /mcp base', () => {
    expect(collectForgeApiBaseCandidates('https://maxprime.obp.mx/mcp')).toEqual([
      'https://maxprime.obp.mx/api',
      'https://maxprime.obp.mx',
    ]);
  });

  it('suggests /api base', () => {
    expect(suggestForgeApiUrl('https://maxprime.obp.mx/mcp')).toBe('https://maxprime.obp.mx/api');
  });

  it('formatForgePromotionError reads Nest HttpException payload', () => {
    const err = new ServiceUnavailableException({
      code: 'FORGE_CREATE_STAGE_FAILED',
      message: 'changeDescription: String must contain at most 8000 character(s)',
    });
    expect(formatForgePromotionError(err)).toBe(
      'changeDescription: String must contain at most 8000 character(s)',
    );
  });
});
