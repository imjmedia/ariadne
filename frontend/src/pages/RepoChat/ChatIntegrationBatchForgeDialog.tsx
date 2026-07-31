/**
 * Modal para promover un lote de integración (N chats) a una sola etapa en The Forge.
 */
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Hammer } from 'lucide-react';
import { api } from '@/api';
import type {
  ForgeBrownfieldProjectOption,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { chatNavBtnClass } from '../chat/chatShellClasses';
import {
  ALL_FORGE_DELIVERABLES,
  FORGE_DELIVERABLE_OPTIONS,
  forgeDeliverablesEqual,
} from './forge-deliverables.constants';
import {
  ForgePromoteProgressPanel,
  useForgePromoteProgress,
} from './forgePromoteProgress';

const forgeSelectTriggerClass = cn(
  'h-11 w-full justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 shadow-none',
  'text-left text-sm font-normal text-[var(--foreground)]',
);

type PreviewParams = {
  stageName: string;
  deliverables: ForgeDeliverableKind[];
};

export function ChatIntegrationBatchForgeDialog(props: {
  batchId: string | null;
  batchLabel?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  onSuccess?: (result: PromoteToTheForgeResponse) => void;
}) {
  const [stageName, setStageName] = useState('');
  const [deliverables, setDeliverables] = useState<ForgeDeliverableKind[]>(ALL_FORGE_DELIVERABLES);
  const [forgeOptions, setForgeOptions] = useState<ForgeBrownfieldProjectOption[]>([]);
  const [loadingForgeOptions, setLoadingForgeOptions] = useState(false);
  const [forgeOptionsHint, setForgeOptionsHint] = useState<string | null>(null);
  const [selectedForgeProjectId, setSelectedForgeProjectId] = useState('');
  const [preview, setPreview] = useState<PreviewIntegrationBatchTheForgeResponse | null>(null);
  const [previewParams, setPreviewParams] = useState<PreviewParams | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<PromoteToTheForgeResponse | null>(null);
  const forgeProgress = useForgePromoteProgress(promoteLoading);

  const previewStale =
    previewParams == null ||
    previewParams.stageName !== stageName.trim() ||
    !forgeDeliverablesEqual(previewParams.deliverables, deliverables);

  const selectedForgeOption = forgeOptions.find((opt) => opt.id === selectedForgeProjectId);
  const linkedForgeProjectId = preview?.linkedForgeProject?.forgeProjectId ?? null;

  const resetState = useCallback(() => {
    setPreview(null);
    setPreviewParams(null);
    setError(null);
    setSuccessResult(null);
    setPreviewLoading(false);
    setPromoteLoading(false);
    setSelectedForgeProjectId('');
    setForgeOptions([]);
    setForgeOptionsHint(null);
  }, []);

  const loadForgeOptions = useCallback(async () => {
    setLoadingForgeOptions(true);
    setForgeOptionsHint(null);
    try {
      const res = await api.listTheForgeBrownfieldProjects();
      setForgeOptions(res.projects);
      setForgeOptionsHint(res.hint ?? null);
      return res.projects;
    } catch (e) {
      setForgeOptions([]);
      setForgeOptionsHint(null);
      setError(e instanceof Error ? e.message : String(e));
      return [];
    } finally {
      setLoadingForgeOptions(false);
    }
  }, []);

  useEffect(() => {
    if (!props.open) {
      resetState();
      return;
    }
    setStageName(props.batchLabel?.trim() || '');
    setDeliverables(ALL_FORGE_DELIVERABLES);
    setPreview(null);
    setPreviewParams(null);
    setError(null);
    void loadForgeOptions().then((projects) => {
      if (projects.length === 1) {
        setSelectedForgeProjectId(projects[0].id);
      }
    });
  }, [props.open, props.batchLabel, resetState, loadForgeOptions]);

  useEffect(() => {
    if (!props.open || selectedForgeProjectId || !linkedForgeProjectId) return;
    if (forgeOptions.some((opt) => opt.id === linkedForgeProjectId)) {
      setSelectedForgeProjectId(linkedForgeProjectId);
    }
  }, [props.open, linkedForgeProjectId, forgeOptions, selectedForgeProjectId]);

  const runPreview = useCallback(async () => {
    if (!props.batchId) return;
    if (!selectedForgeProjectId) {
      setError('Selecciona el proyecto LEGACY destino en The Forge.');
      return;
    }
    if (deliverables.length === 0) {
      setError('Selecciona al menos un entregable.');
      return;
    }
    const trimmedStage = stageName.trim();
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await api.previewIntegrationBatchTheForgePack(props.batchId, {
        stageName: trimmedStage || undefined,
        deliverables,
        forgeProjectId: selectedForgeProjectId,
      });
      setPreview(res);
      setPreviewParams({ stageName: trimmedStage, deliverables: [...deliverables] });
      if (!trimmedStage && res.preview.stageName) {
        setStageName(res.preview.stageName);
        setPreviewParams({ stageName: res.preview.stageName.trim(), deliverables: [...deliverables] });
      }
      if (res.targetForgeProject?.forgeProjectId) {
        setSelectedForgeProjectId(res.targetForgeProject.forgeProjectId);
      }
    } catch (e) {
      setPreview(null);
      setPreviewParams(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }, [props.batchId, stageName, deliverables, selectedForgeProjectId]);

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
    if (!selectedForgeProjectId) {
      setError('Selecciona el proyecto LEGACY destino en The Forge.');
      return;
    }
    if (deliverables.length === 0) {
      setError('Selecciona al menos un entregable.');
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
        forgeProjectId: selectedForgeProjectId,
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

  const busy = previewLoading || promoteLoading || loadingForgeOptions;
  const previewReady = Boolean(preview) && !previewStale;
  const canPromote =
    Boolean(props.batchId) &&
    !props.disabled &&
    !busy &&
    !successResult &&
    previewReady &&
    Boolean(selectedForgeProjectId);

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
            LEGACY que elijas.
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
              <Label htmlFor="batch-forge-legacy-project">Proyecto LEGACY destino</Label>
              {loadingForgeOptions ? (
                <p className="text-xs text-[var(--foreground-muted)]">Cargando proyectos brownfield…</p>
              ) : forgeOptions.length === 0 ? (
                <div className="space-y-1 text-xs text-[var(--foreground-muted)]">
                  <p>No se encontraron proyectos LEGACY en The Forge.</p>
                  {forgeOptionsHint ? <p>{forgeOptionsHint}</p> : null}
                </div>
              ) : (
                <>
                  <Select
                    value={selectedForgeProjectId || undefined}
                    onValueChange={setSelectedForgeProjectId}
                    disabled={busy}
                  >
                    <SelectTrigger id="batch-forge-legacy-project" className={forgeSelectTriggerClass}>
                      <SelectValue placeholder="Selecciona un proyecto LEGACY" />
                    </SelectTrigger>
                    <SelectContent>
                      {forgeOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.name}
                          {opt.groupName ? ` · ${opt.groupName}` : ''}
                          {linkedForgeProjectId === opt.id ? ' (vinculado)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {linkedForgeProjectId &&
                  selectedForgeProjectId &&
                  selectedForgeProjectId !== linkedForgeProjectId ? (
                    <p className="text-[10px] leading-snug text-amber-700 dark:text-amber-400">
                      Destino distinto al vinculado en el detalle del proyecto Ariadne (
                      {preview?.linkedForgeProject?.forgeProjectName ?? linkedForgeProjectId}).
                    </p>
                  ) : null}
                </>
              )}
            </div>

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
                {FORGE_DELIVERABLE_OPTIONS.map((opt) => (
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

            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background-muted)]/30 p-3">
              {previewStale && !previewLoading ? (
                <>
                  <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
                    Pulsa <strong className="font-medium text-[var(--foreground)]">Aplicar cambios</strong>{' '}
                    para generar la vista previa. Puede tardar varios segundos: fusiona todos los chats del
                    lote y prepara el pack para The Forge.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={chatNavBtnClass}
                    disabled={busy || deliverables.length === 0 || !selectedForgeProjectId}
                    onClick={() => void runPreview()}
                  >
                    Aplicar cambios
                  </Button>
                </>
              ) : previewLoading ? (
                <p className="text-xs text-[var(--foreground-muted)]">Generando vista previa…</p>
              ) : preview ? (
                <div className="space-y-2 text-xs">
                  <p>
                    <span className="font-medium">Chats en lote:</span> {preview.preview.conversationCount}{' '}
                    · <span className="font-medium">Archivos fusionados:</span>{' '}
                    {preview.preview.modificationPlanFileCount}
                  </p>
                  {preview.targetForgeProject ? (
                    <p className="text-[var(--foreground-muted)]">
                      Destino: {preview.targetForgeProject.forgeProjectName}
                    </p>
                  ) : selectedForgeOption ? (
                    <p className="text-[var(--foreground-muted)]">Destino: {selectedForgeOption.name}</p>
                  ) : null}
                  {preview.preview.warnings.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-4 text-amber-700 dark:text-amber-400">
                      {preview.preview.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            {promoteLoading ? (
              <ForgePromoteProgressPanel
                progress={forgeProgress.progress}
                stepLabel={forgeProgress.stepLabel}
                hint={
                  forgeProgress.progress >= 92
                    ? 'Creando la etapa en The Forge… puede tardar varios minutos con lotes grandes. No cierres esta ventana.'
                    : 'Enviando el pack fusionado a The Forge…'
                }
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
                {promoteLoading
                  ? 'Enviando…'
                  : !selectedForgeProjectId
                    ? 'Elige proyecto LEGACY'
                    : !previewReady
                      ? 'Aplicar cambios primero'
                      : 'Enviar lote a The Forge'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
