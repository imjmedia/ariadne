/**
 * Modal: pasos del pipeline de sync full (cumplido / en curso / pendiente / fallido).
 */
import { CheckCircle2, Circle, Loader2, XCircle, MinusCircle } from 'lucide-react';
import type { SyncJob } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildSyncPipelineSteps, SYNC_FULL_PIPELINE_STEPS, type PipelineStepState } from './syncPipeline';

export interface SyncPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Pick<SyncJob, 'status' | 'type' | 'payload' | 'errorMessage'> | null;
}

function StepIcon({ state }: { state: PipelineStepState }) {
  switch (state) {
    case 'done':
      return <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
    case 'active':
      return <Loader2 className="size-5 shrink-0 animate-spin text-amber-500" aria-hidden />;
    case 'failed':
      return <XCircle className="size-5 shrink-0 text-destructive" aria-hidden />;
    case 'skipped':
      return <MinusCircle className="size-5 shrink-0 text-amber-600/80 dark:text-amber-400/80" aria-hidden />;
    default:
      return (
        <Circle className="size-5 shrink-0 text-[var(--foreground-muted)] opacity-40" aria-hidden />
      );
  }
}

function stateLabel(state: PipelineStepState): string {
  switch (state) {
    case 'done':
      return 'Completado';
    case 'active':
      return 'En curso';
    case 'failed':
      return 'Falló aquí';
    case 'skipped':
      return 'Omitido';
    default:
      return 'Pendiente';
  }
}

export function SyncPipelineModal({ open, onOpenChange, job }: SyncPipelineModalProps) {
  const steps = job ? buildSyncPipelineSteps(job) : [];

  const phase =
    job?.payload && typeof job.payload.phase === 'string' ? job.payload.phase : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pipeline del sync</DialogTitle>
          <DialogDescription>
            Cinco fases del ingest para sync completo (paso 1–{SYNC_FULL_PIPELINE_STEPS}). En la tabla, la línea de
            resultado usa el mismo numerado; en «Indexando» verás el contador de archivos descargados/parseados.
            {phase && (
              <span className="mt-2 block font-mono text-xs opacity-90">phase actual: {phase}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        {!job ? (
          <p className="text-sm text-muted-foreground">No hay job seleccionado.</p>
        ) : (
          <ol className="space-y-4 pt-2">
            {steps.map((step) => (
              <li key={step.id} className="flex gap-3">
                <div className="pt-0.5">
                  <StepIcon state={step.state} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium leading-snug">{step.title}</span>
                    <span className="text-xs text-[var(--foreground-muted)]">
                      {stateLabel(step.state)}
                    </span>
                  </div>
                  {step.detail && (
                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed break-words">
                      {step.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
