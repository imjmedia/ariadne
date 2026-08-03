/**
 * Progreso real durante promote/create-stage (POST async + polling GET).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatIntegrationBatch, ForgePromotionState, PromoteToTheForgeResponse } from '@/types';
import {
  FORGE_PROMOTION_PHASE_LABEL,
  isKnownForgePromotionPhase,
} from './forge-promotion-phase.constants';
import {
  FORGE_PREVIEW_PHASE_LABEL,
  forgePreviewPhaseLabel,
} from './forge-preview-phase.constants';

export { FORGE_PROMOTION_PHASE_LABEL } from './forge-promotion-phase.constants';

/** @deprecated Usar etiquetas de fase reales desde el backend. */
export const FORGE_PROMOTE_STEPS = [
  FORGE_PROMOTION_PHASE_LABEL.pack_resolve,
  FORGE_PROMOTION_PHASE_LABEL.pack_enrich,
  'Resolviendo proyecto Forge…',
  FORGE_PROMOTION_PHASE_LABEL.forge_create,
] as const;

const POLL_MS = 1500;

export type ForgePromotionPollState = Pick<
  ForgePromotionState,
  'status' | 'phase' | 'percent' | 'lastError' | 'forgeProjectId' | 'forgeStageId' | 'stageUrl'
>;

export function forgePromotionPhaseLabel(phase: string | null | undefined): string {
  if (phase && isKnownForgePromotionPhase(phase) && phase !== 'done' && phase !== 'failed') {
    return FORGE_PROMOTION_PHASE_LABEL[phase];
  }
  return FORGE_PROMOTION_PHASE_LABEL.pack_resolve;
}

export function forgePromotionSuccessFromBatch(
  batch: ChatIntegrationBatch,
): PromoteToTheForgeResponse {
  return {
    status: 'success',
    alreadyPromoted: false,
    forgeProjectId: batch.forgeProjectId,
    forgeStageId: batch.forgeStageId,
    stageUrl: batch.forgeStageUrl,
  };
}

export function forgePromotionSuccessFromState(
  state: ForgePromotionPollState,
): PromoteToTheForgeResponse {
  return {
    status: 'success',
    alreadyPromoted: false,
    forgeProjectId: state.forgeProjectId ?? null,
    forgeStageId: state.forgeStageId ?? null,
    stageUrl: state.stageUrl ?? null,
  };
}

export type ForgePreviewPollState = {
  status: import('@/types').ForgePreviewStatus;
  phase: string | null;
  percent: number | null;
  lastError: string | null;
};

export function useForgePromoteProgressPoll(options: {
  active: boolean;
  poll: () => Promise<ForgePromotionPollState>;
  onSuccess?: (state: ForgePromotionPollState) => void;
  onFailed?: (state: ForgePromotionPollState) => void;
  initialLabel?: string;
  resolveStepLabel?: (phase: string | null | undefined, status: string) => string;
}) {
  const initialLabel = options.initialLabel ?? FORGE_PROMOTION_PHASE_LABEL.pack_resolve;
  const resolveStepLabel = options.resolveStepLabel ?? forgePromotionPhaseLabel;
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState(initialLabel);
  const onSuccessRef = useRef(options.onSuccess);
  const onFailedRef = useRef(options.onFailed);
  onSuccessRef.current = options.onSuccess;
  onFailedRef.current = options.onFailed;

  const pollOnce = useCallback(async () => {
    const state = await options.poll();
    setProgress((prev) =>
      state.percent ??
      (state.status === 'success' ? 100 : state.status === 'failed' ? 0 : prev),
    );
    setStepLabel(
      state.status === 'success' ? 'Completado' : resolveStepLabel(state.phase, state.status),
    );
    return state;
  }, [options.poll, resolveStepLabel]);

  useEffect(() => {
    if (!options.active) {
      setProgress(0);
      setStepLabel(initialLabel);
      return;
    }

    let cancelled = false;
    let finished = false;

    const run = async () => {
      if (cancelled || finished) return;
      try {
        const state = await pollOnce();
        if (cancelled || finished) return;
        if (state.status === 'success') {
          finished = true;
          onSuccessRef.current?.(state);
        } else if (state.status === 'failed') {
          finished = true;
          onFailedRef.current?.(state);
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    void run();
    const timer = window.setInterval(() => void run(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [options.active, pollOnce, initialLabel]);

  return { progress, stepLabel };
}

export function useForgePreviewProgressPoll(options: {
  active: boolean;
  poll: () => Promise<ForgePreviewPollState>;
  onSuccess?: () => void;
  onFailed?: (state: ForgePreviewPollState) => void;
  initialPhase?: 'pack_merge' | 'pack_build';
}) {
  const initialPhase = options.initialPhase ?? 'pack_build';
  const previewPollRef = useRef(options.poll);
  previewPollRef.current = options.poll;

  const pollAdapter = useCallback(async (): Promise<ForgePromotionPollState> => {
    const preview = await previewPollRef.current();
    return {
      status: preview.status,
      phase: preview.phase,
      percent: preview.percent,
      lastError: preview.lastError,
      forgeProjectId: null,
      forgeStageId: null,
      stageUrl: null,
    };
  }, []);

  const onSuccessRef = useRef(options.onSuccess);
  const onFailedRef = useRef(options.onFailed);
  onSuccessRef.current = options.onSuccess;
  onFailedRef.current = options.onFailed;

  return useForgePromoteProgressPoll({
    active: options.active,
    poll: pollAdapter,
    initialLabel: FORGE_PREVIEW_PHASE_LABEL[initialPhase],
    resolveStepLabel: (phase) => forgePreviewPhaseLabel(phase),
    onSuccess: () => onSuccessRef.current?.(),
    onFailed: (state) => {
      onFailedRef.current?.({
        status: state.status as ForgePreviewPollState['status'],
        phase: state.phase,
        percent: state.percent,
        lastError: state.lastError,
      });
    },
  });
}

export function ForgePromoteProgressPanel(props: {
  progress: number;
  stepLabel: string;
  hint?: string;
}) {
  return (
    <div
      className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background-muted)]/50 p-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-[var(--foreground)]">{props.stepLabel}</span>
        <span className="tabular-nums text-[var(--foreground-muted)]">
          {Math.round(props.progress)}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--muted)_55%,var(--background))]"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500 ease-out"
          style={{ width: `${props.progress}%` }}
        />
      </div>
      {props.hint ? (
        <p className="text-[10px] leading-snug text-[var(--foreground-muted)]">{props.hint}</p>
      ) : null}
    </div>
  );
}

/** Progreso simulado (solo create-stage de proyecto, sin polling backend). */
export function useForgePromoteProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      setStepIndex(0);
      return;
    }

    const started = Date.now();
    const STEP_MS = 9_000;
    const TICK_MS = 450;
    const MAX_PROGRESS = 92;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const idx = Math.min(FORGE_PROMOTE_STEPS.length - 1, Math.floor(elapsed / STEP_MS));
      setStepIndex(idx);
      const stepStart = idx * STEP_MS;
      const withinStep = Math.min(STEP_MS, elapsed - stepStart);
      const raw = ((idx + withinStep / STEP_MS) / FORGE_PROMOTE_STEPS.length) * 100;
      setProgress(Math.min(MAX_PROGRESS, raw));
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [active]);

  const finish = () => {
    setStepIndex(FORGE_PROMOTE_STEPS.length - 1);
    setProgress(100);
  };

  return {
    progress,
    stepLabel: FORGE_PROMOTE_STEPS[stepIndex],
    finish,
  };
}
