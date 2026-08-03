import { describe, it, expect } from 'vitest';
import type { ChangePromotionPackV1 } from './change-promotion-pack.types';
import {
  FORBIDDEN_INTEGRATION_HANDOFF_DELIVERABLES,
  INTEGRATION_HANDOFF_FORGE_DELIVERABLES,
  mddEvidenceForForgePack,
  normalizeIntegrationHandoffDeliverables,
} from './integration-handoff-pack.util';

function samplePack(): ChangePromotionPackV1 {
  return {
    schemaVersion: '1.1',
    source: 'ariadne',
    kind: 'change_promotion',
    generatedAt: '2026-08-03T00:00:00.000Z',
    idempotencyKey: 'x',
    promotionScope: 'integration_handoff',
    ariadne: {
      conversationId: 'batch-1',
      conversationTitle: 'Lote',
      repositoryId: 'repo-1',
      projectId: 'proj-1',
      projectKey: 'obp',
      repoSlug: 'oohbp2',
      commitSha: null,
      indexFresh: true,
      indexStaleHours: 0,
    },
    change: {
      title: 'Integración costos',
      stageKey: 'INT_COSTOS',
      userDescription: 'Handoff NEW-LEG',
      decisions: [],
      erDiagramMermaid: null,
      migrationNotes: null,
    },
    mdd: {
      summary: 'Legacy OBP',
      endpoints: [{ method: 'POST', path: '/auth/local' }],
      userStories: [{ id: 'US-001', title: 'Login' }],
    },
    modificationPlan: {
      filesToModify: [{ path: 'oohbp2/src/pages/Cotizador.tsx', repoId: 'repo-1' }],
    },
    deliverablesRequested: ['modification_plan'],
  };
}

describe('integration-handoff-pack.util', () => {
  it('strips baseline deliverables from integration batch defaults', () => {
    expect(normalizeIntegrationHandoffDeliverables(undefined)).toEqual(
      INTEGRATION_HANDOFF_FORGE_DELIVERABLES,
    );
    expect(
      normalizeIntegrationHandoffDeliverables([
        'modification_plan',
        'migration_tasks',
        'change_spec',
        'api_contracts',
      ]),
    ).toEqual(['modification_plan', 'api_contracts']);
    expect(normalizeIntegrationHandoffDeliverables(['migration_tasks'])).toEqual(
      INTEGRATION_HANDOFF_FORGE_DELIVERABLES,
    );
    for (const forbidden of FORBIDDEN_INTEGRATION_HANDOFF_DELIVERABLES) {
      expect(normalizeIntegrationHandoffDeliverables([forbidden])).toEqual(
        INTEGRATION_HANDOFF_FORGE_DELIVERABLES,
      );
    }
  });

  it('summarize MDD drops userStories/endpoints for Forge evidence', () => {
    const evidence = mddEvidenceForForgePack(samplePack());
    expect(evidence).not.toHaveProperty('userStories');
    expect(evidence.pathsInHandoffScope).toEqual(['oohbp2/src/pages/Cotizador.tsx']);
    expect(evidence.endpointCount).toBe(1);
  });
});
