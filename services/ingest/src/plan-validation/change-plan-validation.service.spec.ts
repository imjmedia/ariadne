/**
 * @fileoverview Unit tests for ChangePlanValidationService (mocked graph).
 */
import { describe, it, expect, vi } from 'vitest';
import { ChangePlanValidationService } from './change-plan-validation.service';
import type { ChangePlan } from './change-plan-validation.types';

function buildService(deps: {
  indexedPaths?: string[];
  symbols?: Record<string, boolean>;
  modificationFiles?: Array<{ path: string; repoId: string }>;
}) {
  const cypher = {
    executeCypher: vi.fn(async (_pid: string, query: string, params?: Record<string, unknown>) => {
      if (query.includes('MATCH (f:File)')) {
        return (deps.indexedPaths ?? []).map((path) => ({ path }));
      }
      if (query.includes('n.name = $name')) {
        const name = String(params?.name ?? '');
        return deps.symbols?.[name] ? [{ name }] : [];
      }
      if (query.includes('API_Endpoint')) return [];
      return [];
    }),
  };
  const chat = {
    getModificationPlanFilesOnlyByProject: vi.fn(async () => deps.modificationFiles ?? []),
  };
  const repos = {
    findOne: vi.fn(async () => null),
    getProjectIdsForRepo: vi.fn(async () => ['proj-1']),
  };
  const projects = { findOne: vi.fn(async () => ({ id: 'proj-1' })) };
  const syncStatus = {
    getStatusForProjectOrRepo: vi.fn(async () => ({
      status: 'up_to_date',
      lastSync: new Date().toISOString(),
      lastCommitSha: 'abc',
      stale: false,
      staleAfterHours: 72,
      recommendation: null,
      details: [],
      repositories: [],
    })),
    isStaleBlocked: vi.fn(() => true),
  };
  return new ChangePlanValidationService(
    cypher as never,
    chat as never,
    repos as never,
    projects as never,
    syncStatus as never,
  );
}

const basePlan = (): ChangePlan => ({
  schemaVersion: '1.0',
  projectId: 'proj-1',
  source: 'theforge',
  files: [{ path: 'src/components/Foo.tsx', changeType: 'modify', symbols: ['Foo'] }],
});

describe('ChangePlanValidationService', () => {
  it('APPROVED when file and symbol exist', async () => {
    const svc = buildService({
      indexedPaths: ['src/components/Foo.tsx'],
      symbols: { Foo: true },
    });
    const report = await svc.validate('proj-1', basePlan());
    expect(report.verdict).toBe('APPROVED');
    expect(report.checks.some((c) => c.id === 'FILE_EXISTS' && c.status === 'pass')).toBe(true);
  });

  it('BLOCKED when file missing from graph', async () => {
    const svc = buildService({ indexedPaths: [] });
    const report = await svc.validate('proj-1', basePlan());
    expect(report.verdict).toBe('BLOCKED');
    expect(report.blockers.some((b) => b.includes('not in graph'))).toBe(true);
  });

  it('warns on RECOMPUTE_GAP when modification-plan has extra files', async () => {
    const svc = buildService({
      indexedPaths: ['src/components/Foo.tsx'],
      symbols: { Foo: true },
      modificationFiles: [
        { path: 'src/components/Foo.tsx', repoId: 'r1' },
        { path: 'src/api/bar.ts', repoId: 'r1' },
      ],
    });
    const plan = { ...basePlan(), changeDescription: 'Add discount field' };
    const report = await svc.validate('proj-1', plan);
    expect(report.coverage.missingFromPlan).toContain('src/api/bar.ts');
  });

  it('BLOCKED when dependsOn references unknown task id', async () => {
    const svc = buildService({
      indexedPaths: ['src/components/Foo.tsx'],
      symbols: { Foo: true },
    });
    const plan: ChangePlan = {
      ...basePlan(),
      tasks: [
        {
          id: 'T1',
          title: 'Update Foo',
          files: ['src/components/Foo.tsx'],
          symbols: ['Foo'],
          phase: '1-core',
          criterion: 'Keep Foo props',
          dependsOn: ['T99'],
        },
      ],
    };
    const report = await svc.validate('proj-1', plan);
    expect(report.verdict).toBe('BLOCKED');
    expect(report.checks.some((c) => c.id === 'TASK_DEPENDS_ON' && c.status === 'fail')).toBe(true);
  });
});
