/**
 * Progreso estimado mientras corre promote/create-stage (POST bloqueante, sin SSE).
 */
import { useEffect, useState } from 'react';

export const FORGE_PROMOTE_STEPS = [
  'Preparando change pack…',
  'Generando tareas Cursor (# Tasks)…',
  'Resolviendo proyecto Forge…',
  'Creando etapa en The Forge…',
] as const;

const STEP_MS = 9_000;
const TICK_MS = 450;
const MAX_PROGRESS = 92;

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
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const idx = Math.min(
        FORGE_PROMOTE_STEPS.length - 1,
        Math.floor(elapsed / STEP_MS),
      );
      setStepIndex(idx);

      const stepStart = idx * STEP_MS;
      const stepSpan = STEP_MS * FORGE_PROMOTE_STEPS.length;
      const withinStep = Math.min(STEP_MS, elapsed - stepStart);
      const raw =
        ((idx + withinStep / STEP_MS) / FORGE_PROMOTE_STEPS.length) * 100;
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
