import { describe, it, expect } from 'vitest';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';
import {
  buildForgeChangeDescription,
  toForgeChangePackV1,
  toForgeCreateStageApiBody,
} from './forge-create-stage.mapper';

function samplePack(): ChangePromotionPackV1 {
  return {
    schemaVersion: '1.1',
    source: 'ariadne',
    kind: 'change_promotion',
    generatedAt: '2026-07-17T00:00:00.000Z',
    idempotencyKey: 'abc123',
    ariadne: {
      conversationId: 'conv-1',
      conversationTitle: 'Reingeniería',
      repositoryId: 'repo-1',
      projectId: 'proj-1',
      projectKey: 'kreo',
      repoSlug: 'app',
      commitSha: 'deadbeef',
      indexFresh: true,
      indexStaleHours: 1,
    },
    change: {
      title: 'Reingeniería BD',
      stageKey: 'REING_BD_V2',
      userDescription: 'Normalizar tablas de medios',
      decisions: ['Usar Prisma migrate'],
      erDiagramMermaid: 'erDiagram\n  A ||--o{ B : x',
      migrationNotes: 'Fase expand-contract',
    },
    mdd: { summary: 'as-is' },
    modificationPlan: {
      filesToModify: [{ path: 'src/db/schema.ts', repoId: 'repo-1' }],
      questionsToRefine: ['¿Soft delete en medios?'],
    },
    deliverablesRequested: ['change_spec', 'data_model'],
  };
}

describe('forge-create-stage.mapper', () => {
  it('maps to Forge pack v1', () => {
    const forgePack = toForgeChangePackV1(samplePack());
    expect(forgePack.version).toBe('1');
    expect(forgePack.ariadneChangeId).toBe('REING_BD_V2');
    expect(forgePack.ariadneRepositoryId).toBe('repo-1');
    expect(forgePack.filesToModify).toHaveLength(1);
    expect(forgePack.questionsToRefine).toEqual(['¿Soft delete en medios?']);
    expect(forgePack.handoffItems?.some((h) => h.kind === 'mdd_evidence')).toBe(true);
  });

  it('buildForgeChangeDescription includes decisions and ERD', () => {
    const desc = buildForgeChangeDescription(samplePack());
    expect(desc).toContain('Normalizar tablas');
    expect(desc).toContain('Prisma migrate');
    expect(desc).toContain('erDiagram');
  });

  it('sets runLegacyStart false when files present', () => {
    const body = toForgeCreateStageApiBody({
      forgeProjectId: 'forge-1',
      pack: samplePack(),
      stageName: 'Etapa 2',
      wireAriadne: true,
    });
    expect(body.runLegacyStart).toBe(false);
    expect(body.wireAriadne).toBe(true);
    expect(body.stageName).toBe('Etapa 2');
  });

  it('defaults runLegacyStart true without files', () => {
    const pack = samplePack();
    pack.modificationPlan.filesToModify = [];
    const body = toForgeCreateStageApiBody({
      forgeProjectId: 'forge-1',
      pack,
      stageName: 'Etapa vacía',
    });
    expect(body.runLegacyStart).toBe(true);
  });
});
