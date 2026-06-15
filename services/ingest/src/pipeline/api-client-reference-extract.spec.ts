import { describe, expect, it } from 'vitest';
import {
  extractApiClientReferences,
  extractExternalApiReferences,
  normalizeApiClientPath,
} from './api-client-reference-extract';

describe('api-client-reference-extract', () => {
  it('normaliza api/campanias/', () => {
    expect(normalizeApiClientPath('api/campanias/')).toBe('campanias');
    expect(normalizeApiClientPath('/api/users-permissions/roles')).toBe('users-permissions/roles');
    expect(normalizeApiClientPath('api/users/${id}')).toBe('users');
  });

  it('extrae literales api/ y /api/ en TSX', () => {
    const src = `
      axiosQuery('GET', 'api/campanias');
      apiDirection="api/users-permissions/roles"
      fetch('/api/clientes');
      api.get("/api/auth/ariadne-config");
      const BASE = "/api/provider-instances";
    `;
    const refs = extractApiClientReferences(src);
    const paths = refs.map((r) => r.apiPath);
    expect(paths).toContain('api/campanias');
    expect(paths).toContain('api/users-permissions/roles');
    expect(paths).toContain('api/clientes');
    expect(paths).toContain('api/auth/ariadne-config');
    expect(paths).toContain('api/provider-instances');
  });

  it('extrae prefijos dinámicos api/users/ + id', () => {
    const src = `
      axiosQuery('PUT', 'api/users/' + data.id, null, {});
      await axiosQuery('GET', 'api/cotizadores/' + cotizadorId);
      return 'api/medios/' + id;
    `;
    const refs = extractApiClientReferences(src);
    const dynamic = refs.filter((r) => r.isDynamic);
    expect(dynamic.map((r) => r.normalizedPath)).toEqual(
      expect.arrayContaining(['users', 'cotizadores', 'medios']),
    );
  });

  it('detecta APIs externas SSO/tasks', () => {
    const src = `
      url: (import.meta.env.MODE === 'development'
        ? 'https://tasksdev.imjmedia.com.mx/'
        : 'https://tasks.imjmedia.com.mx/') + 'api/users',
      url2: 'https://sso.imjmedia.com.mx/api/users/' + data.id,
    `;
    const refs = extractExternalApiReferences(src);
    expect(refs.some((r) => r.service === 'tasks' && r.normalizedPath === 'users')).toBe(true);
    expect(refs.some((r) => r.service === 'sso')).toBe(true);
  });
});
