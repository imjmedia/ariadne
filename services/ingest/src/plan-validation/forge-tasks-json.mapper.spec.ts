import { describe, it, expect } from 'vitest';
import { changePlanFromForgeTasksJson } from './forge-tasks-json.mapper';

describe('changePlanFromForgeTasksJson', () => {
  it('maps tasksJson v2-like payload to ChangePlan', () => {
    const plan = changePlanFromForgeTasksJson('proj-1', {
      tasks: [
        {
          id: 'T1',
          title: 'Extract modal',
          files: ['src/pages/Tareas/functions.ts'],
          symbols: ['createTask'],
          phase: '1-core',
          criterion: 'Keep createTask signature',
          evidence: [{ kind: 'symbol', ref: 'createTask' }],
          dependsOn: [],
        },
        {
          id: 'T2',
          title: 'Wire users',
          files: ['src/pages/Usuarios/ABCUsuarios.tsx'],
          symbols: ['ABCUsuarios'],
          phase: '2-integrate',
          criterion: 'Permissions matrix unchanged',
          dependsOn: ['T1'],
        },
      ],
    });
    expect(plan.files).toHaveLength(2);
    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks?.[1]?.dependsOn).toEqual(['T1']);
    expect(plan.source).toBe('theforge');
  });

  it('throws when no files can be derived', () => {
    expect(() => changePlanFromForgeTasksJson('proj-1', { tasks: [{ title: 'Empty' }] })).toThrow(
      /no files/i,
    );
  });
});
