/**
 * Pasos del pipeline de sync **full** según `payload.phase` y estado del job (ingest).
 */

export type PipelineStepState = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

export interface PipelineStepView {
  id: string;
  title: string;
  detail?: string;
  state: PipelineStepState;
}

/** Orden de fases en ingest (sync.service `updateJobProgress`). */
function phaseRank(phase: unknown): number {
  const p = typeof phase === 'string' ? phase : '';
  switch (p) {
    case 'queued':
      return 0;
    case 'mapping':
      return 1;
    case 'mapping_done':
      return 2;
    case 'indexing':
      return 3;
    case 'writing_graph':
      return 4;
    case 'embeddings':
      return 5;
    default:
      return -1;
  }
}

function embedInlineSummary(payload: Record<string, unknown> | null | undefined): string | null {
  const raw = payload?.embedIndex;
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (e.skipped === true) return `Omitido: ${String(e.reason ?? 'configuración')}`;
  if (e.ran === true && e.failed === true) return `Falló: ${String(e.message ?? 'error')}`;
  if (e.ran === true)
    return `${typeof e.indexed === 'number' ? e.indexed : '—'} vectores indexados · ${typeof e.errors === 'number' ? e.errors : '—'} errores`;
  return null;
}

/** Pasos del sync full mostrados en tabla Jobs / cola (debe coincidir con el modal de pipeline). */
export const SYNC_FULL_PIPELINE_STEPS = 5;

/**
 * Una línea compacta para jobs en cola o en curso: `Paso X/5: …`.
 * En fase `indexing` incluye el contador `current/total`.
 */
export function formatRunningSyncHeadline(
  payload: Record<string, unknown> | null | undefined,
  status: 'running' | 'queued',
): string | null {
  if (status === 'queued') {
    return `Paso 1/${SYNC_FULL_PIPELINE_STEPS}: Encolado…`;
  }

  if (!payload) {
    return `Paso 2/${SYNC_FULL_PIPELINE_STEPS}: Sincronizando…`;
  }

  const phase = typeof payload.phase === 'string' ? payload.phase : '';

  if (phase === 'queued') {
    return `Paso 1/${SYNC_FULL_PIPELINE_STEPS}: Encolado…`;
  }

  const metaByPhase: Record<string, { step: number; title: string }> = {
    mapping: { step: 2, title: 'Descubrimiento de rutas' },
    mapping_done: { step: 2, title: 'Descubrimiento de rutas' },
    indexing: { step: 3, title: 'Indexando' },
    writing_graph: { step: 4, title: 'Escritura en grafo Falkor' },
    embeddings: { step: 5, title: 'Índice de embeddings' },
  };

  const meta = metaByPhase[phase];
  if (!meta) {
    return `Paso 2/${SYNC_FULL_PIPELINE_STEPS}: Sincronizando…`;
  }

  const prefix = `Paso ${meta.step}/${SYNC_FULL_PIPELINE_STEPS}: ${meta.title}`;

  if (phase === 'indexing') {
    const cur = payload.current;
    const tot = payload.total;
    if (typeof cur === 'number' && typeof tot === 'number') {
      return `${prefix} ${cur}/${tot}`;
    }
    return `${prefix}…`;
  }

  if (phase === 'mapping_done' && typeof payload.filesFound === 'number') {
    return `${prefix} · ${payload.filesFound} archivos listados`;
  }

  if (phase === 'writing_graph') {
    const gt = payload.graphBatchTotal;
    if (typeof gt === 'number' && gt > 0) return `${prefix} · ~${gt} fuentes`;
    return `${prefix}…`;
  }

  if (phase === 'mapping' || phase === 'embeddings') {
    return `${prefix}…`;
  }

  return `${prefix}…`;
}

/**
 * Construye la lista de pasos para la UI (modal).
 * `jobType` distinto de `full` devuelve un solo paso informativo.
 */
export function buildSyncPipelineSteps(job: {
  status: string;
  type?: string;
  payload?: Record<string, unknown> | null;
  errorMessage?: string | null;
}): PipelineStepView[] {
  const { status, type, payload, errorMessage } = job;

  if (type && type !== 'full') {
    return [
      {
        id: 'other',
        title: 'Job incremental u otro tipo',
        detail:
          'El desglose por fases detallado aplica al sync completo (`full`). Este job usa otro flujo en el ingest.',
        state: status === 'completed' ? 'done' : status === 'failed' ? 'failed' : 'active',
      },
    ];
  }

  const rank = phaseRank(payload?.phase);
  const filesFound =
    typeof payload?.filesFound === 'number' ? (payload.filesFound as number) : null;
  const cur = typeof payload?.current === 'number' ? payload.current : null;
  const total = typeof payload?.total === 'number' ? payload.total : null;
  const graphBatch =
    typeof payload?.graphBatchTotal === 'number' ? payload.graphBatchTotal : null;

  const baseTitles: Array<{ id: string; title: string; describe: () => string | undefined }> = [
    {
      id: 'queue',
      title: 'Encolado',
      describe: () => undefined,
    },
    {
      id: 'discover',
      title: 'Descubrimiento de rutas',
      describe: () =>
        filesFound != null ? `${filesFound} rutas candidatas en el repo` : undefined,
    },
    {
      id: 'fetch_parse',
      title: 'Descarga y parseo de fuentes',
      describe: () =>
        cur != null && total != null ? `Progreso API/tree-sitter: ${cur}/${total}` : undefined,
    },
    {
      id: 'falkor',
      title: 'Escritura en grafo Falkor',
      describe: () =>
        graphBatch != null
          ? `≈${graphBatch} fuentes → lotes Cypher (incluye Prisma/OpenAPI, C4 y limpieza)`
          : 'Lotes Cypher hacia Falkor (varios grafos si aplica sharding)',
    },
    {
      id: 'embeddings',
      title: 'Índice de embeddings',
      describe: () => embedInlineSummary(payload ?? undefined) ?? undefined,
    },
  ];

  const assignStates = (activeIndex: number, failedIndex: number | null): PipelineStepView[] =>
    baseTitles.map((s, i) => {
      let state: PipelineStepState = 'pending';
      if (failedIndex !== null) {
        if (i < failedIndex) state = 'done';
        else if (i === failedIndex) state = 'failed';
        else state = 'pending';
      } else {
        if (i < activeIndex) state = 'done';
        else if (i === activeIndex) state = 'active';
        else state = 'pending';
      }
      const detail = s.describe();
      return {
        id: s.id,
        title: s.title,
        ...(detail ? { detail } : {}),
        state,
      };
    });

  const embedSkipped =
    payload &&
    typeof payload.embedIndex === 'object' &&
    payload.embedIndex !== null &&
    (payload.embedIndex as Record<string, unknown>).skipped === true;

  if (status === 'completed') {
    const steps: PipelineStepView[] = baseTitles.map((s) => {
      const detail = s.describe();
      return {
        id: s.id,
        title: s.title,
        ...(detail ? { detail } : {}),
        state: 'done' as PipelineStepState,
      };
    });
    const embIdx = steps.findIndex((x) => x.id === 'embeddings');
    if (embIdx >= 0 && embedSkipped) {
      const reason =
        typeof (payload?.embedIndex as Record<string, unknown>)?.reason === 'string'
          ? String((payload!.embedIndex as Record<string, unknown>).reason)
          : 'SYNC_SKIP_EMBED_INDEX / INGEST_SKIP_EMBED_INDEX';
      steps[embIdx] = {
        ...steps[embIdx],
        state: 'skipped',
        detail: `Omitido: ${reason}`,
      };
    } else if (embIdx >= 0) {
      const sum = embedInlineSummary(payload ?? undefined);
      if (sum) steps[embIdx] = { ...steps[embIdx], detail: sum };
    }
    return steps;
  }

  if (status === 'queued') {
    return assignStates(0, null);
  }

  if (status === 'running') {
    let activeStep = 1;
    if (rank >= 0) {
      if (rank <= 2) activeStep = 1;
      else if (rank === 3) activeStep = 2;
      else if (rank === 4) activeStep = 3;
      else activeStep = 4;
    }

    const steps = assignStates(activeStep, null);
    return steps.map((s, i) => {
      if (i !== activeStep) return s;
      const extra: string[] = [];
      if (s.id === 'fetch_parse' && typeof payload?.lastFile === 'string') {
        const lf = payload!.lastFile as string;
        extra.push(`Último archivo: …/${lf.split('/').slice(-2).join('/')}`);
      }
      const detail = [s.detail, ...extra].filter(Boolean).join(' · ');
      return detail ? { ...s, detail } : s;
    });
  }

  if (status === 'failed') {
    let failedStep = 4;
    if (rank <= 0) failedStep = 0;
    else if (rank <= 2) failedStep = 1;
    else if (rank === 3) failedStep = 2;
    else if (rank === 4) failedStep = 3;
    else if (rank === 5) failedStep = 4;

    const steps = assignStates(failedStep, failedStep).map((s, i) =>
      i === failedStep && s.state === 'failed'
        ? {
            ...s,
            detail: [s.detail, errorMessage?.trim() ? `Error: ${errorMessage!.trim()}` : '']
              .filter(Boolean)
              .join(' · '),
          }
        : s,
    );
    return steps;
  }

  return assignStates(0, null);
}
