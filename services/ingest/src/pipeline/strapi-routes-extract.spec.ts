import { describe, expect, it } from 'vitest';
import { parseStrapiRoutesFile, parseStrapiRoutesFromJsSource } from './strapi-routes-extract';

describe('strapi-routes-extract', () => {
  it('parsea routes.json de extension', () => {
    const path = 'src/extensions/users-permissions/config/routes.json';
    const content = JSON.stringify({
      routes: [
        {
          method: 'GET',
          path: '/users-permissions/roles',
          handler: 'role.find',
        },
      ],
    });
    const out = parseStrapiRoutesFile(path, content);
    expect(out?.routes).toHaveLength(1);
    expect(out?.routes[0]?.method).toBe('GET');
    expect(out?.routes[0]?.path).toBe('/users-permissions/roles');
    expect(out?.routes[0]?.apiName).toBe('users-permissions');
  });

  it('parsea routes custom.js de Strapi API', () => {
    const path = 'src/api/campania/routes/custom.js';
    const content = `module.exports = {
      routes: [
        { method: 'POST', path: '/createCampaniaWDetalles', handler: 'campania.createCampaniaWDetalles' },
        { method: 'GET', path: '/listaCampania', handler: 'campania.listaCampania' },
      ],
    };`;
    const out = parseStrapiRoutesFile(path, content);
    expect(out?.routes.length).toBeGreaterThanOrEqual(2);
    expect(out?.apiName).toBe('campania');
  });

  it('parseStrapiRoutesFromJsSource extrae bloques sueltos', () => {
    const routes = parseStrapiRoutesFromJsSource(
      `{ method: 'PUT', path: '/foo', handler: 'x.y' }`,
    );
    expect(routes).toHaveLength(1);
    expect(routes[0]?.method).toBe('PUT');
  });

  it('parseStrapiRoutesFromJsSource soporta config anidado en custom routes', () => {
    const routes = parseStrapiRoutesFromJsSource(`module.exports = {
      routes: [
        {
          method: 'GET',
          path: '/listaCampania',
          handler: 'campania.listaCampania',
          config: { auth: false },
        },
      ],
    };`);
    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe('/listaCampania');
  });
});
