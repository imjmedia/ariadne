import { describe, it, expect } from 'vitest';
import { buildSyncPipelineSteps, formatRunningSyncHeadline, SYNC_FULL_PIPELINE_STEPS } from './syncPipeline';

describe('formatRunningSyncHeadline', () => {
  it('indexing incluye contador', () => {
    expect(
      formatRunningSyncHeadline({ phase: 'indexing', current: 1176, total: 1176 }, 'running'),
    ).toBe(`Paso 3/${SYNC_FULL_PIPELINE_STEPS}: Indexando 1176/1176`);
  });
});

describe('buildSyncPipelineSteps', () => {
  it('queued: solo encolado activo', () => {
    const steps = buildSyncPipelineSteps({
      status: 'queued',
      type: 'full',
      payload: { phase: 'queued' },
    });
    expect(steps[0].state).toBe('active');
    expect(steps.slice(1).every((s) => s.state === 'pending')).toBe(true);
  });

  it('running indexing: paso fetch_parse activo', () => {
    const steps = buildSyncPipelineSteps({
      status: 'running',
      type: 'full',
      payload: { phase: 'indexing', current: 100, total: 200 },
    });
    const fp = steps.find((s) => s.id === 'fetch_parse');
    expect(fp?.state).toBe('active');
    expect(steps.find((s) => s.id === 'queue')?.state).toBe('done');
  });

  it('completed: todos done y embeddings con resumen si hay embedIndex', () => {
    const steps = buildSyncPipelineSteps({
      status: 'completed',
      type: 'full',
      payload: {
        indexed: 10,
        total: 10,
        embedIndex: { ran: true, skipped: false, indexed: 42, errors: 0 },
      },
    });
    expect(steps.every((s) => s.state === 'done')).toBe(true);
    expect(steps.find((s) => s.id === 'embeddings')?.detail).toContain('42');
  });

  it('incremental: un solo paso informativo', () => {
    const steps = buildSyncPipelineSteps({ status: 'completed', type: 'incremental', payload: {} });
    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe('other');
  });
});
