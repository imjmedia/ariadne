import { describe, expect, it } from 'vitest';
import {
  buildLlmContextLengthMessage,
  extractOpenRouterProviderMessage,
  isContextLengthProviderMessage,
  isLlmContextLengthError,
  mapOpenRouterHttpError,
  parseContextLengthFromMessage,
} from './llm-openrouter-error.util.js';

const SAMPLE = `{"error":{"message":"This endpoint's maximum context length is 262144 tokens. However, you requested about 285795 tokens (277217 of text input, 386 of tool input, 8192 in the output). Please reduce the length of either one, or use the context-compression plugin to compress your prompt automatically.","code":400}}`;

describe('llm-openrouter-error.util', () => {
  it('detects context length from OpenRouter 400 body', () => {
    const msg = extractOpenRouterProviderMessage(SAMPLE);
    expect(isContextLengthProviderMessage(msg)).toBe(true);
    expect(parseContextLengthFromMessage(msg)).toEqual({
      maxContextTokens: 262144,
      requestedTokens: 285795,
    });
  });

  it('maps to LlmContextLengthError with user-facing Spanish message', () => {
    const err = mapOpenRouterHttpError(400, SAMPLE, 'moonshotai/kimi-k2');
    expect(err).not.toBeNull();
    expect(isLlmContextLengthError(err)).toBe(true);
    if (!isLlmContextLengthError(err)) return;
    expect(err.model).toBe('moonshotai/kimi-k2');
    expect(err.maxContextTokens).toBe(262144);
    expect(err.requestedTokens).toBe(285795);
    expect(err.message).toContain('moonshotai/kimi-k2');
    expect(err.message).toContain('262,144');
    expect(buildLlmContextLengthMessage('x', 1000, 2000)).toContain('1,000');
  });
});
