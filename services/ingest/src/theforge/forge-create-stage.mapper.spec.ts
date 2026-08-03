import { describe, it, expect } from 'vitest';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';
import { FORGE_HANDOFF_ITEM_ID_REGEX } from './change-promotion-pack.types';
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
    deliverablesRequested: ['change_spec', 'data_model', 'migration_tasks'],
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
    expect(forgePack.handoffItems?.every((h) => h.id && h.description)).toBe(true);
    expect(forgePack.handoffItems?.every((h) => FORGE_HANDOFF_ITEM_ID_REGEX.test(h.id))).toBe(true);
    expect(forgePack.handoffItems?.some((h) => h.kind === 'mdd_evidence')).toBe(true);
    expect(forgePack.handoffItems?.find((h) => h.kind === 'mdd_evidence')?.id).toBe('mdd-evidence');
  });

  it('assigns unique ids for deliverable_request handoffs', () => {
    const pack = samplePack();
    pack.deliverablesRequested = [
      'change_spec',
      'data_model',
      'api_contracts',
      'modification_plan',
      'migration_tasks',
      'mdd_full',
    ];
    const items = toForgeChangePackV1(pack).handoffItems ?? [];
    const deliverables = items.filter((h) => h.kind === 'deliverable_request');
    expect(deliverables).toHaveLength(6);
    expect(deliverables.every((h) => h.id.startsWith('deliverable-request-'))).toBe(true);
    expect(deliverables.every((h) => FORGE_HANDOFF_ITEM_ID_REGEX.test(h.id))).toBe(true);
    expect(deliverables.every((h) => h.description === h.title)).toBe(true);
    expect(new Set(deliverables.map((h) => h.id)).size).toBe(6);
    expect(deliverables.find((h) => h.title === 'api_contracts')?.id).toBe(
      'deliverable-request-api-contracts',
    );
  });

  it('includes enriched evidence and post_deliverable_gate for migration_tasks', () => {
    const pack = samplePack();
    pack.graphEvidenceBundle = {
      schemaVersion: '1.0',
      generatedAt: '2026-07-20T00:00:00.000Z',
      projectId: 'proj-1',
      files: [
        {
          path: 'src/db/schema.ts',
          repoId: 'repo-1',
          symbols: ['Media'],
          dependents: [{ symbol: 'Media', count: 2, breakingRisk: 'low' }],
          props: [],
          apiTouches: [],
          impactScore: 10,
        },
      ],
    };
    pack.changePlanSeed = {
      schemaVersion: '1.0',
      projectId: 'proj-1',
      source: 'theforge',
      files: [{ path: 'src/db/schema.ts', changeType: 'modify', symbols: ['Media'] }],
      tasks: [
        {
          id: 'T1',
          title: 'Actualizar Media',
          files: ['src/db/schema.ts'],
          symbols: ['Media'],
          phase: '1-core',
          criterion: 'Keep Media contract',
        },
      ],
    };
    const forgePack = toForgeChangePackV1(pack);
    expect(forgePack.handoffItems?.some((h) => h.kind === 'modification_plan_enriched')).toBe(true);
    expect(forgePack.handoffItems?.some((h) => h.kind === 'change_plan_seed')).toBe(true);
    expect(forgePack.handoffItems?.some((h) => h.kind === 'post_deliverable_gate')).toBe(true);
  });

  it('buildForgeChangeDescription includes decisions and ERD', () => {
    const desc = buildForgeChangeDescription(samplePack());
    expect(desc).toContain('Normalizar tablas');
    expect(desc).toContain('Prisma migrate');
    expect(desc).toContain('erDiagram');
  });

  it('includes cursor handoff items when present', () => {
    const pack = samplePack();
    pack.changeWorkDescription = '# Trabajo\n\nDetalle';
    pack.cursorTasksMarkdown = '# Tasks\n\n## Backend tasks\n### Fase 1\n---\nid: T-001\nsection: Backend\ntitle: x\nstatus: pending\nchange_type: modify\nparallel: true\ndepends_on: []\ncontext:\n  mdd_ref: x\n  story_ref: ""\n  why: x\nscope:\n  include:\n    - a.ts\n  exclude: []\nrequirements:\n  - x\nverification:\n  - run: echo ok\n    expect_exit: 0\ndone_when:\n  - ok\n---\n- [ ] T-001 — x';
    const forgePack = toForgeChangePackV1(pack);
    expect(forgePack.handoffItems?.some((h) => h.kind === 'change_work_description')).toBe(true);
    expect(forgePack.handoffItems?.some((h) => h.kind === 'cursor_tasks_markdown')).toBe(true);
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
