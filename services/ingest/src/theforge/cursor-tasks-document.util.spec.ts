import { describe, it, expect } from 'vitest';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';
import {
  cursorTasksFromChangePlanSeed,
  normalizeCursorTasksMarkdown,
  validateCursorTasksMarkdown,
} from './cursor-tasks-document.util';

function samplePack(): ChangePromotionPackV1 {
  return {
    schemaVersion: '1.1',
    source: 'ariadne',
    kind: 'change_promotion',
    generatedAt: '2026-07-24T00:00:00.000Z',
    idempotencyKey: 'abc',
    ariadne: {
      conversationId: 'project:proj-1',
      conversationTitle: null,
      repositoryId: 'repo-1',
      projectId: 'proj-1',
      projectKey: 'app',
      repoSlug: 'api',
      commitSha: null,
      indexFresh: true,
      indexStaleHours: 1,
    },
    change: {
      title: 'Refactor auth',
      stageKey: 'REFACTOR_AUTH',
      userDescription: 'Extraer servicio de autenticación',
      decisions: [],
      erDiagramMermaid: null,
      migrationNotes: null,
    },
    mdd: { summary: 'as-is' },
    modificationPlan: {
      filesToModify: [
        { path: 'services/ingest/src/auth/auth.service.ts', repoId: 'repo-1' },
        { path: 'frontend/src/pages/Login.tsx', repoId: 'repo-1' },
      ],
    },
    changePlanSeed: {
      schemaVersion: '1.0',
      projectId: 'proj-1',
      source: 'theforge',
      files: [],
      tasks: [
        {
          id: 'T-001',
          title: 'Refactor AuthService',
          files: ['services/ingest/src/auth/auth.service.ts'],
          symbols: ['AuthService'],
          phase: '1-core',
          criterion: 'Mantener contrato',
        },
      ],
    },
    deliverablesRequested: ['modification_plan', 'migration_tasks'],
  };
}

describe('cursor-tasks-document.util', () => {
  it('normalize strips preamble and fences', () => {
    const raw = 'Intro\n\n```markdown\n# Tasks\n\n## Backend tasks\n';
    const out = normalizeCursorTasksMarkdown(raw);
    expect(out.startsWith('# Tasks')).toBe(true);
  });

  it('fallback produces valid structure', () => {
    const md = cursorTasksFromChangePlanSeed(samplePack());
    const v = validateCursorTasksMarkdown(md);
    expect(v.valid).toBe(true);
    expect(md).toContain('## Backend tasks');
    expect(md).toContain('## Frontend tasks');
    expect(md).toContain('## Testing tasks');
    expect(md).toContain('T-001');
  });
});
