import { describe, expect, it } from 'vitest';
import {
  isPublicEntryRoute,
  publicEntryStrapiApiHints,
  publicEntryApiNameMatchCypher,
} from './react-route-public-entry';

describe('react-route-public-entry', () => {
  it('isPublicEntryRoute', () => {
    expect(isPublicEntryRoute('/urbanos/public')).toBe(true);
    expect(isPublicEntryRoute('/visualizacionCampania/:linkkey')).toBe(true);
    expect(isPublicEntryRoute('/campanias')).toBe(false);
  });

  it('publicEntryStrapiApiHints', () => {
    const hints = publicEntryStrapiApiHints('/urbanos/public/:ruta');
    expect(hints).toContain('ruta');
    expect(hints).toContain('urbanos');
  });

  it('publicEntryApiNameMatchCypher is non-empty', () => {
    expect(publicEntryApiNameMatchCypher('rt', 'sr')).toContain('rt.path');
  });
});
