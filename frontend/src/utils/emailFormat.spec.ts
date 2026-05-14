import { describe, expect, it } from 'vitest';
import { isValidEmailFormat } from './emailFormat';

describe('isValidEmailFormat', () => {
  it('accepts typical corporate addresses', () => {
    expect(isValidEmailFormat('user@empresa.com')).toBe(true);
    expect(isValidEmailFormat('a.b@c.co.uk')).toBe(true);
  });

  it('rejects missing or multiple @', () => {
    expect(isValidEmailFormat('no-at')).toBe(false);
    expect(isValidEmailFormat('a@b@c.com')).toBe(false);
    expect(isValidEmailFormat('@nodomain.com')).toBe(false);
  });

  it('rejects domain without dot or short TLD', () => {
    expect(isValidEmailFormat('user@localhost')).toBe(false);
    expect(isValidEmailFormat('user@a.c')).toBe(false);
  });
});
