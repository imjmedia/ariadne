import {
  buildBatchContentFingerprint,
  buildIntegrationPreviewParamsHash,
} from './integration-preview-cache.util';

describe('integration-preview-cache.util', () => {
  it('buildIntegrationPreviewParamsHash is stable for same inputs', () => {
    const params = {
      batchId: 'batch-1',
      stageName: 'Integración',
      stageKey: 'integracion',
      deliverables: ['change_spec', 'mdd'] as const,
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
});
