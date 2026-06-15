import { describe, expect, it } from 'vitest';
import {
  extractGraphQlClientReferences,
  sourceReferencesGraphQlEndpoint,
} from './graphql-client-reference-extract';

describe('graphql-client-reference-extract', () => {
  it('extrae operaciones nombradas y campos raíz', () => {
    const src = [
      'const q = gql`',
      '  query GetMedios {',
      '    mediosCercanos(distancia: 1) { id }',
      '  }',
      '`;',
    ].join('\n');
    const refs = extractGraphQlClientReferences(src);
    expect(refs.some((r) => r.operationName === 'GetMedios' && r.rootField === 'mediosCercanos')).toBe(true);
  });

  it('extrae documento anónimo', () => {
    const src = 'graphql`{ rutasEnArea(distancia: 1) { id } }`';
    const refs = extractGraphQlClientReferences(src);
    expect(refs.some((r) => r.rootField === 'rutasEnArea')).toBe(true);
  });

  it('sourceReferencesGraphQlEndpoint', () => {
    expect(sourceReferencesGraphQlEndpoint('fetch("/graphql", { method: "POST" })')).toBe(true);
    expect(sourceReferencesGraphQlEndpoint('api/campanias')).toBe(false);
  });
});
