import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  assertValidGraphProperty,
  suggestGraphPropertyKey,
  suggestEmbeddingSpaceKey,
  LEGACY_EMBEDDING_PROPERTY,
} from './graph-property.util';

describe('LEGACY_EMBEDDING_PROPERTY', () => {
  it('equals "embedding"', () => {
    expect(LEGACY_EMBEDDING_PROPERTY).toBe('embedding');
  });
});

describe('assertValidGraphProperty()', () => {
  it('accepts valid identifier starting with letter', () => {
    expect(assertValidGraphProperty('embedding')).toBe('embedding');
  });

  it('accepts identifier starting with underscore', () => {
    expect(assertValidGraphProperty('_embedding')).toBe('_embedding');
  });

  it('accepts identifier with alphanumeric and underscores', () => {
    expect(assertValidGraphProperty('emb_nomic_768')).toBe('emb_nomic_768');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(assertValidGraphProperty('  embedding  ')).toBe('embedding');
  });

  it('throws BadRequestException when starts with digit', () => {
    expect(() => assertValidGraphProperty('3bad')).toThrow(BadRequestException);
  });

  it('throws BadRequestException for hyphenated name', () => {
    expect(() => assertValidGraphProperty('emb-vec')).toThrow(BadRequestException);
  });

  it('throws BadRequestException for empty string', () => {
    expect(() => assertValidGraphProperty('')).toThrow(BadRequestException);
  });

  it('throws BadRequestException for name longer than 128 chars', () => {
    expect(() => assertValidGraphProperty('a'.repeat(129))).toThrow(BadRequestException);
  });

  it('accepts name of exactly 128 chars', () => {
    const name = 'a' + 'b'.repeat(127);
    expect(assertValidGraphProperty(name)).toBe(name);
  });
});

describe('suggestGraphPropertyKey()', () => {
  it('produces a valid Cypher property name', () => {
    const key = suggestGraphPropertyKey('openrouter', 'text-embedding-3-small', 1536);
    expect(() => assertValidGraphProperty(key)).not.toThrow();
  });

  it('starts with emb_ prefix', () => {
    const key = suggestGraphPropertyKey('openrouter', 'text-embedding-3-small', 1536);
    expect(key).toMatch(/^emb_/);
  });

  it('replaces invalid chars (slashes, hyphens) with underscores', () => {
    const key = suggestGraphPropertyKey('openrouter', 'nomic/nomic-embed', 768);
    expect(key).not.toMatch(/[/\-]/);
  });

  it('does not start with a digit (prepends _ if needed)', () => {
    const key = suggestGraphPropertyKey('1p', '2m', 3);
    expect(key).not.toMatch(/^\d/);
  });

  it('returns a string no longer than 128 chars', () => {
    const key = suggestGraphPropertyKey('a'.repeat(60), 'b'.repeat(60), 9999);
    expect(key.length).toBeLessThanOrEqual(128);
  });
});

describe('suggestEmbeddingSpaceKey()', () => {
  it('combines provider, model and dimension', () => {
    const key = suggestEmbeddingSpaceKey('openrouter', 'text-embedding-3-small', 1536);
    expect(key).toContain('openrouter');
    expect(key).toContain('1536');
  });

  it('replaces invalid chars with underscores', () => {
    const key = suggestEmbeddingSpaceKey('openrouter', 'nomic/embed-text-v1', 768);
    expect(key).not.toMatch(/[/\-]/);
  });

});
