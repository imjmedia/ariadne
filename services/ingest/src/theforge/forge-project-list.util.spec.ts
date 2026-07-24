import { describe, it, expect } from 'vitest';
import {
  extractForgeProjectRows,
  isLikelyAriadneProjectList,
  readForgeProjectType,
} from './forge-project-list.util';

describe('forge-project-list.util', () => {
  it('unwraps { projects: [...] }', () => {
    const rows = extractForgeProjectRows({
      projects: [{ id: '1', name: 'OBP', projectType: 'LEGACY' }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('1');
  });

  it('detects Ariadne-shaped project lists', () => {
    expect(
      isLikelyAriadneProjectList([
        { id: 'p1', name: 'Mono', repositories: [{ id: 'r1' }] },
      ]),
    ).toBe(true);
  });

  it('reads projectType case-insensitively', () => {
    expect(readForgeProjectType({ project_type: 'legacy' })).toBe('LEGACY');
  });
});
