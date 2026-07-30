/**
 * Modal para promover un lote de integración (N chats) a una sola etapa en The Forge.
 */
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Hammer } from 'lucide-react';
import { api } from '@/api';
import type {
  ForgeDeliverableKind,
  PreviewIntegrationBatchTheForgeResponse,
  PromoteToTheForgeResponse,
} from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { chatNavBtnClass } from '../chat/chatShellClasses';
import {
  ForgePromoteProgressPanel,
  useForgePromoteProgress,
} from './forgePromoteProgress';

const DELIVERABLE_OPTIONS: { id: ForgeDeliverableKind; label: string }[] = [
  { id: 'change_spec', label: 'Especificación del cambio' },
  { id: 'data_model', label: 'Modelo de datos (ERD)' },
  { id: 'modification_plan', label: 'Plan de modificación' },
  { id: 'migration_tasks', label: 'Tareas de migración' },
  { id: 'api_contracts', label: 'Contratos API' },
  { id: 'mdd_full', label: 'MDD completo' },
];

const DEFAULT_DELIVERABLES: ForgeDeliverableKind[] = [
  'change_spec',
  'data_model',
  'modification_plan',
  'migration_tasks',
];

export function ChatIntegrationBatchForgeDialog(props: {
  batchId: string | null;
  batchLabel?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  onSuccess?: (result: PromoteToTheForgeResponse) => void;
}) {
  const [stageName, setStageName] = useState('');
  const [deliverables, setDeliverables] = useState<ForgeDeliverableKind[]>(DEFAULT_DELIVERABLES);
  const [preview, setPreview] = useState<PreviewIntegrationBatchTheForgeResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<PromoteToTheForgeResponse | null>(null);
  const forgeProgress = useForgePromoteProgress(promoteLoading);

  const resetState = useCallback(() => {
    setPreview(null);
    setError(null);
    setSuccessResult(null);
    setPreviewLoading(false);
    setPromoteLoading(false);
  }, []);

  useEffect(() => {
    if (!props.open) {
      resetState();
      return;
    }
    setStageName(props.batchLabel?.trim() || '');
    setDeliverables(DEFAULT_DELIVERABLES);
  }, [props.open, props.batchLabel, resetState]);

  const runPreview = useCallback(async () => {
    if (!props.batchId) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await api.previewIntegrationBatchTheForgePack(props.batchId, {
        stageName: stageName.trim() || undefined,
        deliverables,
      });
      setPreview(res);
      if (!stageName.trim() && res.preview.stageName) {
        setStageName(res.preview.stageName);
      }
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }, [props.batchId, stageName, deliverables]);

  useEffect(() => {
    if (!props.open || !props.batchId) return;
    const timer = window.setTimeout(() => void runPreview(), 400);
    return () => window.clearTimeout(timer);
  }, [props.open, props.batchId, stageName, deliverables, runPreview]);

  const toggleDeliverable = (id: ForgeDeliverableKind) => {
    setDeliverables((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const runPromote = async () => {
    if (!props.batchId) return;
    const name = stageName.trim();
    if (!name) {
      setError('Indica un nombre para la etapa.');
      return;
    }
    setPromoteLoading(true);
    setError(null);
    try {
      const result = await api.promoteIntegrationBatchToTheForge(props.batchId, {
        stageName: name,
        stageKey: preview?.preview.stageKeySuggested,
        deliverables,
        activate: false,
      });
      forgeProgress.finish();
      await new Promise((r) => window.setTimeout(r, 350));
      setSuccessResult(result);
      props.onSuccess?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPromoteLoading(false);
    }
  };

  const busy = previewLoading || promoteLoading;
  const canPromote = Boolean(props.batchId) && !props.disabled && !busy && !successResult;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="size-4 shrink-0" aria-hidden />
            Enviar lote a The Forge
          </DialogTitle>
          <DialogDescription>
            Fusiona los {preview?.preview.conversationCount ?? '…'} chats del lote{' '}
            <strong>{props.batchLabel ?? 'de integración'}</strong> en una sola etapa del proyecto
            LEGACY vinculado.
          </DialogDescription>
        </DialogHeader>

        {successResult ? (
          <div className="space-y-3">
            <Alert className="rounded-xl">
              <AlertTitle>Etapa creada</AlertTitle>
              <AlertDescription>
                El lote completo se promovió a The Forge en una sola etapa.
              </AlertDescription>
            </Alert>
            {successResult.stageUrl ? (
              <Button variant="outline" className={cn(chatNavBtnClass, 'gap-2')} asChild>
                <a href={successResult.stageUrl} target="_blank" rel="noreferrer">
                  Abrir etapa en The Forge
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-forge-stage-name">Nombre de la etapa</Label>
              <Input
                id="batch-forge-stage-name"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                disabled={busy}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Entregables</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {DELIVERABLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={deliverables.includes(opt.id)}
                      onChange={() => toggleDeliverable(opt.id)}
                      disabled={busy}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {previewLoading ? (
              <p className="text-xs text-[var(--foreground-muted)]">Generando vista previa…</p>
            ) : preview ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--background-muted)]/40 p-3 text-xs">
                <p>
                  <span className="font-medium">Chats en lote:</span> {preview.preview.conversationCount}{' '}
                  · <span className="font-medium">Archivos fusionados:</span>{' '}
                  {preview.preview.modificationPlanFileCount}
                </p>
                {preview.linkedForgeProject ? (
                  <p className="mt-2 text-[var(--foreground-muted)]">
                    Destino: {preview.linkedForgeProject.forgeProjectName}
                  </p>
                ) : null}
              </div>
            ) : null}
            {promoteLoading ? (
              <ForgePromoteProgressPanel
                progress={forgeProgress.progress}
                stepLabel={forgeProgress.stepLabel}
                hint="Fusionando packs y creando la etapa en The Forge…"
              />
            ) : null}
            {error ? (
              <Alert variant="destructive" className="rounded-xl">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {successResult ? (
            <Button type="button" onClick={() => props.onOpenChange(false)}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className={chatNavBtnClass} onClick={() => props.onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={!canPromote} onClick={() => void runPromote()}>
                {promoteLoading ? 'Enviando…' : 'Enviar lote a The Forge'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
