import { describe, expect, it } from 'vitest';
import { scanC4Infrastructure } from './c4-infrastructure';

describe('scanC4Infrastructure', () => {
  it('detecta servicios en docker-compose con build relativo y depends_on', async () => {
    const pathSet = new Set(['docker-compose.yml', 'services/api/src/index.ts']);
    const getContent = async (p: string) => {
      if (p === 'docker-compose.yml') {
        return `services:
  api:
    build: ./services/api
    depends_on:
      - db
  db:
    image: postgres:15
`;
      }
      return null;
    };
    const { spec, composePath } = await scanC4Infrastructure(pathSet, getContent, 'org/repo');
    expect(composePath).toBe('docker-compose.yml');
    expect(spec.containers.some((c) => c.name === 'api')).toBe(true);
    expect(spec.containers.find((c) => c.name === 'api')?.pathPrefixes).toContain('services/api/');
    expect(spec.containers.find((c) => c.name === 'db')?.c4Kind).toBe('database');
    expect(spec.communications?.some((c) => c.fromKey === 'api' && c.toKey === 'db')).toBe(true);
  });
});
