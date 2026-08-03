import { describe, it, expect } from 'vitest';
import type { ForgeDeliverableKind } from './change-promotion-pack.types';
import {
  buildBatchContentFingerprint,
  buildIntegrationPreviewParamsHash,
  resolveIntegrationPreviewStageKey,
} from './integration-preview-cache.util';

describe('integration-preview-cache.util', () => {
  it('buildIntegrationPreviewParamsHash is stable for same inputs', () => {
    const params = {
      batchId: 'batch-1',
      stageName: 'Integración',
      stageKey: 'integracion',
      deliverables: ['change_spec', 'mdd'] as ForgeDeliverableKind[],
      contentFingerprint: 'abc123',
    };
    expect(buildIntegrationPreviewParamsHash(params)).toBe(
      buildIntegrationPreviewParamsHash(params),
    );
  });

  it('buildIntegrationPreviewParamsHash changes when deliverables differ', () => {
    const base = {
      batchId: 'batch-1',
      stageName: 'Integración',
      contentFingerprint: 'abc123',
    };
    const a = buildIntegrationPreviewParamsHash({
      ...base,
      deliverables: ['change_spec'],
    });
    const b = buildIntegrationPreviewParamsHash({
      ...base,
      deliverables: ['change_spec', 'mdd'],
    });
    expect(a).not.toBe(b);
  });

  it('buildBatchContentFingerprint ignores row order', () => {
    const rowsA = [
      { conversationId: 'a', messageCount: 2, lastMessageAt: '2026-01-01' },
      { conversationId: 'b', messageCount: 1, lastMessageAt: null },
    ];
    const rowsB = [...rowsA].reverse();
    expect(buildBatchContentFingerprint(rowsA)).toBe(buildBatchContentFingerprint(rowsB));
  });

  it('resolveIntegrationPreviewStageKey uses pack stageKey when preview omits explicit key', () => {
    expect(resolveIntegrationPreviewStageKey(undefined, 'INTEGRACION_LOTE')).toBe('INTEGRACION_LOTE');
    expect(resolveIntegrationPreviewStageKey('', 'INTEGRACION_LOTE')).toBe('INTEGRACION_LOTE');
  });

  it('preview and promote hashes align when promote sends stageKeySuggested', () => {
    const base = {
      batchId: 'batch-1',
      stageName: 'Integración lote',
      contentFingerprint: 'abc123',
      deliverables: ['change_spec', 'migration_tasks'] as ForgeDeliverableKind[],
    };
    const previewHash = buildIntegrationPreviewParamsHash({
      ...base,
      stageKey: resolveIntegrationPreviewStageKey(undefined, 'INTEGRACION_LOTE'),
    });
    const promoteHash = buildIntegrationPreviewParamsHash({
      ...base,
      stageKey: resolveIntegrationPreviewStageKey('INTEGRACION_LOTE', 'INTEGRACION_LOTE'),
    });
    expect(previewHash).toBe(promoteHash);
  });
});
