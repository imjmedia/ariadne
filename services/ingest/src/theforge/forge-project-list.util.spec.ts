import { describe, it, expect } from 'vitest';
import {
  extractForgeProjectRows,
  isForgeAriadneIndexedProjectList,
  isForgeLegacyProject,
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

  it('detects Forge Ariadne index lists (roots[], not Workshop)', () => {
    expect(
      isForgeAriadneIndexedProjectList([
        {
          id: '31b04fd7-13ff-4f61-90b6-2f9870c940a1',
          name: 'OBP',
          roots: [{ id: '89698d97-309c-42b8-bd84-ed1b16bce906', name: 'desarrollo_imj/erp' }],
        },
      ]),
    ).toBe(true);
  });

  it('reads projectType case-insensitively', () => {
    expect(readForgeProjectType({ project_type: 'legacy' })).toBe('LEGACY');
  });

  it('accepts BROWNFIELD alias', () => {
    expect(isForgeLegacyProject({ projectType: 'brownfield' })).toBe(true);
  });

  it('detects LEGACY via stages[].isLegacy when projectType is omitted', () => {
    expect(
      isForgeLegacyProject({
        id: '125a1455-c030-40d4-aa30-83b2cdec97ff',
        name: 'OBP',
        stages: [{ id: 's1', isLegacy: true }],
      }),
    ).toBe(true);
  });

  it('rejects NEW projects without legacy signals', () => {
    expect(
      isForgeLegacyProject({
        id: 'x',
        name: 'Greenfield',
        projectType: 'NEW',
        stages: [{ id: 's1', isLegacy: false }],
      }),
    ).toBe(false);
  });
});
