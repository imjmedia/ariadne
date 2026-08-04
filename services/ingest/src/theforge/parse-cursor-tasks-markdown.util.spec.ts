import { describe, it, expect } from 'vitest';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';
import { buildForgeTasksJsonSeed } from './forge-tasks-json-seed.util';
import { parseCursorTasksMarkdownToSeed } from './parse-cursor-tasks-markdown.util';

const SAMPLE_TASKS_MD = `# Tasks

## Backend tasks
### Fase 1 — API
---
id: T-001
section: Backend
title: Crear proxy BFF costos
status: pending
change_type: create
parallel: true
depends_on: []
context:
  story_ref: "NEW-LEG-01"
scope:
  include:
    - src/api/costos/routes.ts
  exclude: []
---
- [ ] T-001 — Crear proxy BFF costos

## Frontend tasks
### Fase 1
---
id: T-002
section: Frontend
title: Icono costos cotizador
status: pending
change_type: create
parallel: true
depends_on:
  - T-001
context:
  story_ref: "NEW-LEG-01"
scope:
  include:
    - src/components/CostosMedioIcon.tsx
  exclude: []
---
- [ ] T-002 — Icono costos cotizador

## Infraestructura tasks
_Sin tareas en esta categoría para el alcance actual._

## Testing tasks
_Sin tareas en esta categoría para el alcance actual._

## Deploy tasks
_Sin tareas en esta categoría para el alcance actual._
`;

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
      projectId: '00000000-0000-4000-8000-000000000001',
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
    promotionScope: 'integration_handoff',
  };
}

describe('parseCursorTasksMarkdownToSeed', () => {
  it('parses YAML blocks into tasksJson v2 seed', () => {
    const r = parseCursorTasksMarkdownToSeed(SAMPLE_TASKS_MD, {
      projectId: '00000000-0000-4000-8000-000000000001',
      changeDescription: 'Wiring',
      ariadneChangeId: 'INT_COSTOS',
      promotionScope: 'integration_handoff',
    });
    if (!r.ok) {
      throw new Error(`parse failed: ${r.errors.join('; ')}`);
    }
    expect(r.ok).toBe(true);
    expect(r.seed.tasks).toHaveLength(2);
    expect(r.seed.tasks[0]?.id).toBe('T-001');
    expect(r.seed.tasks[0]?.storyRef).toBe('NEW-LEG-01');
    expect(r.seed.tasks[1]?.dependsOn).toEqual(['T-001']);
  });
});

describe('buildForgeTasksJsonSeed from markdown SSOT', () => {
  it('prefers cursorTasksMarkdown over changePlanSeed graph tasks', () => {
    const pack = samplePack();
    pack.cursorTasksMarkdown = SAMPLE_TASKS_MD;
    pack.changePlanSeed = {
      schemaVersion: '1.0',
      projectId: pack.ariadne.projectId,
      source: 'theforge',
      files: [{ path: 'src/pages/Catalogo.tsx', changeType: 'modify' }],
      tasks: [
        {
          id: 'T1',
          title: 'Actualizar Catalogo',
          files: ['src/pages/Catalogo.tsx'],
          phase: '1-core',
          criterion: 'Grafo',
        },
      ],
    };
    const seed = buildForgeTasksJsonSeed(pack);
    expect(seed?.tasks).toHaveLength(2);
    expect(seed?.tasks[0]?.id).toBe('T-001');
    expect(seed?.tasks[0]?.source).toBe('ariadne_cursor_tasks_markdown');
  });
});
