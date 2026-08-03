import { describe, it, expect } from 'vitest';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';
import {
  buildForgeTasksJsonSeed,
  shouldIncludeForgeTasksJsonSeed,
} from './forge-tasks-json-seed.util';

function samplePack(): ChangePromotionPackV1 {
  return {
    schemaVersion: '1.1',
    source: 'ariadne',
    kind: 'change_promotion',
    generatedAt: '2026-07-17T00:00:00.000Z',
    idempotencyKey: 'abc',
    ariadne: {
      conversationId: 'conv-1',
      conversationTitle: 'Integración',
      repositoryId: 'repo-1',
      projectId: 'proj-1',
      projectKey: 'kreo',
      repoSlug: 'app',
      commitSha: null,
      indexFresh: true,
      indexStaleHours: 1,
    },
    change: {
      title: 'Costos en catálogo',
      stageKey: 'INT_COSTOS',
      userDescription: 'Wiring costos NEW→LEG',
      decisions: [],
      erDiagramMermaid: null,
      migrationNotes: null,
    },
    mdd: {},
    modificationPlan: {
      filesToModify: [{ path: 'src/pages/Catalogo.tsx', repoId: 'repo-1' }],
    },
    deliverablesRequested: ['modification_plan'],
  };
}

describe('forge-tasks-json-seed.util', () => {
  it('builds tasksJson v2 from changePlanSeed', () => {
    const pack = samplePack();
    pack.changePlanSeed = {
      schemaVersion: '1.0',
      projectId: 'proj-1',
      source: 'theforge',
      files: [{ path: 'src/pages/Catalogo.tsx', changeType: 'modify' }],
      tasks: [
        {
          id: 'T-001',
          title: 'Wire costos API',
          files: ['src/pages/Catalogo.tsx'],
          symbols: ['CatalogoPage'],
          phase: '1-core',
          criterion: 'Mostrar costos en previsualizador',
        },
      ],
    };
    const seed = buildForgeTasksJsonSeed(pack);
    expect(seed?.schemaVersion).toBe('2');
    expect(seed?.source).toBe('ariadne');
    expect(seed?.tasks).toHaveLength(1);
    expect(seed?.tasks[0].id).toBe('T-001');
    expect(seed?.files).toHaveLength(1);
  });

  it('falls back to modificationPlan when no changePlanSeed tasks', () => {
    const pack = samplePack();
    pack.promotionScope = 'integration_handoff';
    const seed = buildForgeTasksJsonSeed(pack);
    expect(seed?.tasks).toHaveLength(1);
    expect(seed?.tasks[0].source).toBe('ariadne_modification_plan');
  });

  it('shouldInclude when cursorTasksMarkdown present', () => {
    const pack = samplePack();
    pack.cursorTasksMarkdown = '# Tasks\n\n## Backend tasks\n';
    expect(shouldIncludeForgeTasksJsonSeed(pack)).toBe(true);
  });

  it('returns null when nothing to derive', () => {
    const pack = samplePack();
    pack.modificationPlan.filesToModify = [];
    expect(buildForgeTasksJsonSeed(pack)).toBeNull();
  });
});
