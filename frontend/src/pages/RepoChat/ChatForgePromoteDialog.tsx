/**
 * Modal para promover una conversación de chat a una etapa en The Forge.
 */
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Hammer } from 'lucide-react';
import { api } from '@/api';
import type {
  ForgeDeliverableKind,
  ForgeProjectCandidate,
  PreviewTheForgePackResponse,
  PromoteToTheForgeResponse,
} from '@/types';
import { isPreviewTheForgePackPending } from '@/types';
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
  forgePromotionSuccessFromState,
  useForgePreviewProgressPoll,
  useForgePromoteProgressPoll,
  type ForgePreviewPollState,
  type ForgePromotionPollState,
} from './forgePromoteProgress';
import {
  ALL_FORGE_DELIVERABLES,
  FORGE_DELIVERABLE_OPTIONS,
  forgeDeliverablesEqual,
} from './forge-deliverables.constants';
import { ChatIntegrationBatchForgeDialog } from './ChatIntegrationBatchForgeDialog';

type PreviewParams = {
  stageName: string;
  deliverables: ForgeDeliverableKind[];
};

export function ChatForgePromoteDialog(props: {
  conversationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  defaultStageName?: string;
  onSuccess?: (result: PromoteToTheForgeResponse) => void;
}) {
  const [stageName, setStageName] = useState('');
  const [deliverables, setDeliverables] = useState<ForgeDeliverableKind[]>(ALL_FORGE_DELIVERABLES);
  const [preview, setPreview] = useState<PreviewTheForgePackResponse | null>(null);
  const [previewParams, setPreviewParams] = useState<PreviewParams | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPollActive, setPreviewPollActive] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promotePollActive, setPromotePollActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ForgeProjectCandidate[] | null>(null);
  const [selectedForgeProjectId, setSelectedForgeProjectId] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<PromoteToTheForgeResponse | null>(null);
  const [linkedForgeProjectId, setLinkedForgeProjectId] = useState<string | null>(null);
  const [linkedForgeProjectName, setLinkedForgeProjectName] = useState<string | null>(null);

  const pollConversationPreview = useCallback(async (): Promise<ForgePreviewPollState> => {
    if (!props.conversationId) throw new Error('conversationId required');
    const state = await api.getConversationForgePromotion(props.conversationId);
    return {
      status: state.previewStatus,
      phase: state.previewPhase,
      percent: state.previewPercent,
      lastError: state.previewLastError,
    };
  }, [props.conversationId]);

  const handlePreviewPollSuccess = useCallback(async () => {
    setPreviewPollActive(false);
    setPreviewLoading(false);
    if (!props.conversationId) return;
    const res = await api.getConversationPreviewTheForgePackResult(props.conversationId);
    setPreview(res);
    const trimmedStage = stageName.trim();
    setPreviewParams({ stageName: trimmedStage, deliverables: [...deliverables] });
    if (res.linkedForgeProject?.forgeProjectId) {
      setLinkedForgeProjectId(res.linkedForgeProject.forgeProjectId);
      setLinkedForgeProjectName(res.linkedForgeProject.forgeProjectName ?? null);
    } else {
      setLinkedForgeProjectId(null);
      setLinkedForgeProjectName(null);
    }
    const resolvedStage =
      !trimmedStage && res.preview.changeTitle ? res.preview.changeTitle.trim() : trimmedStage;
    if (!trimmedStage && res.preview.changeTitle) {
      setStageName(res.preview.changeTitle);
    }
    setPreviewParams({ stageName: resolvedStage, deliverables: [...deliverables] });
  }, [props.conversationId, stageName, deliverables]);

  const handlePreviewPollFailed = useCallback((state: ForgePreviewPollState) => {
    setPreviewPollActive(false);
    setPreviewLoading(false);
    setPreview(null);
    setPreviewParams(null);
    setError(state.lastError ?? 'Error al generar la vista previa.');
  }, []);

  const previewProgress = useForgePreviewProgressPoll({
    active: previewPollActive,
    poll: pollConversationPreview,
    onSuccess: () => void handlePreviewPollSuccess(),
    onFailed: handlePreviewPollFailed,
    initialPhase: 'pack_build',
  });

  const pollConversationPromotion = useCallback(async (): Promise<ForgePromotionPollState> => {
    if (!props.conversationId) throw new Error('conversationId required');
    const state = await api.getConversationForgePromotion(props.conversationId);
    return {
      status: state.status,
      phase: state.phase,
      percent: state.percent,
      lastError: state.lastError,
      forgeProjectId: state.forgeProjectId,
      forgeStageId: state.forgeStageId,
      stageUrl: state.stageUrl,
    };
  }, [props.conversationId]);

  const handlePollFailed = useCallback((state: ForgePromotionPollState) => {
    setPromotePollActive(false);
    setPromoteLoading(false);
    const raw = state.lastError;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          code?: string;
          candidates?: ForgeProjectCandidate[];
          message?: string;
        };
        if (parsed.code === 'FORGE_RESOLVE_AMBIGUOUS' && parsed.candidates?.length) {
          setCandidates(parsed.candidates);
          setError(parsed.message ?? 'Varios proyectos Forge coinciden. Elige uno.');
          return;
        }
      } catch {
        /* plain text error */
      }
    }
    setError(raw ?? 'Error al promover a The Forge.');
  }, []);

  const handlePollSuccess = useCallback(
    (state: ForgePromotionPollState) => {
      setPromotePollActive(false);
      setPromoteLoading(false);
      const result = forgePromotionSuccessFromState(state);
      setSuccessResult(result);
      props.onSuccess?.(result);
    },
    [props.onSuccess],
  );

  const forgeProgress = useForgePromoteProgressPoll({
    active: promotePollActive,
    poll: pollConversationPromotion,
    onSuccess: handlePollSuccess,
    onFailed: handlePollFailed,
  });

  const previewStale =
    previewParams == null ||
    previewParams.stageName !== stageName.trim() ||
    !forgeDeliverablesEqual(previewParams.deliverables, deliverables);

  const resetState = useCallback(() => {
    setPreview(null);
    setPreviewParams(null);
    setError(null);
    setCandidates(null);
    setSelectedForgeProjectId(null);
    setSuccessResult(null);
    setLinkedForgeProjectId(null);
    setLinkedForgeProjectName(null);
    setPreviewLoading(false);
    setPreviewPollActive(false);
    setPromoteLoading(false);
    setPromotePollActive(false);
  }, []);

  useEffect(() => {
    if (!props.open) {
      resetState();
      return;
    }
    setStageName(props.defaultStageName?.trim() || '');
    setDeliverables(ALL_FORGE_DELIVERABLES);
    setPreview(null);
    setPreviewParams(null);
  }, [props.open, props.defaultStageName, resetState]);

  const runPreview = useCallback(async () => {
    if (!props.conversationId) return;
    if (deliverables.length === 0) {
      setError('Selecciona al menos un entregable.');
      return;
    }
    const trimmedStage = stageName.trim();
    setPreviewLoading(true);
    setPreviewPollActive(false);
    setError(null);
    setCandidates(null);
    try {
      const result = await api.previewTheForgePack(props.conversationId, {
        stageName: trimmedStage || undefined,
        deliverables,
      });
      if (isPreviewTheForgePackPending(result)) {
        setPreviewPollActive(true);
        return;
      }
      setPreviewLoading(false);
      setPreview(result);
      setPreviewParams({ stageName: trimmedStage, deliverables: [...deliverables] });
      if (result.linkedForgeProject?.forgeProjectId) {
        setLinkedForgeProjectId(result.linkedForgeProject.forgeProjectId);
        setLinkedForgeProjectName(result.linkedForgeProject.forgeProjectName ?? null);
      } else {
        setLinkedForgeProjectId(null);
        setLinkedForgeProjectName(null);
      }
      const resolvedStage =
        !trimmedStage && result.preview.changeTitle ? result.preview.changeTitle.trim() : trimmedStage;
      if (!trimmedStage && result.preview.changeTitle) {
        setStageName(result.preview.changeTitle);
      }
      setPreviewParams({ stageName: resolvedStage, deliverables: [...deliverables] });
    } catch (e) {
      setPreviewLoading(false);
      setPreview(null);
      setPreviewParams(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [props.conversationId, stageName, deliverables]);

  const toggleDeliverable = (id: ForgeDeliverableKind) => {
    setDeliverables((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const runPromote = async (forgeProjectId?: string) => {
    if (!props.conversationId) return;
    const name = stageName.trim();
    if (!name) {
      setError('Indica un nombre para la etapa.');
      return;
    }
    if (deliverables.length === 0) {
      setError('Selecciona al menos un entregable.');
      return;
    }

    setPromoteLoading(true);
    setPromotePollActive(false);
    setError(null);
    try {
      const result = await api.promoteConversationToTheForge(props.conversationId, {
        stageName: name,
        stageKey: preview?.preview.stageKeySuggested,
        deliverables,
        activate: false,
        ...(forgeProjectId
          ? { forgeProjectId }
          : linkedForgeProjectId
            ? { forgeProjectId: linkedForgeProjectId }
            : {}),
      });
      if (result.status === 'pending') {
        setPromotePollActive(true);
        return;
      }
      setPromoteLoading(false);
      setSuccessResult(result);
      props.onSuccess?.(result);
    } catch (e) {
      setPromoteLoading(false);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('FORGE_RESOLVE_AMBIGUOUS') || msg.includes('409')) {
        try {
          const jsonStart = msg.indexOf('{');
          if (jsonStart >= 0) {
            const parsed = JSON.parse(msg.slice(msg.indexOf('{'))) as {
              candidates?: ForgeProjectCandidate[];
            };
            if (parsed.candidates?.length) {
              setCandidates(parsed.candidates);
              setError('Varios proyectos Forge coinciden. Elige uno.');
              return;
            }
          }
        } catch {
          /* fall through */
        }
      }
      setError(msg);
    }
  };

  const showPreviewProgress = previewLoading || previewPollActive;
  const showPromoteProgress = promoteLoading || promotePollActive;
  const busy = showPreviewProgress || showPromoteProgress;
  const canPromote = Boolean(props.conversationId) && !props.disabled && !busy && !successResult;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="size-4 shrink-0" aria-hidden />
            Enviar a The Forge
          </DialogTitle>
          <DialogDescription>
            Crea una etapa en The Forge con el contexto de esta conversación (MDD, ERD y plan de
            archivos).
          </DialogDescription>
        </DialogHeader>

        {successResult ? (
          <div className="space-y-3">
            <Alert className="rounded-xl">
              <AlertTitle>Etapa creada</AlertTitle>
              <AlertDescription>
                {successResult.alreadyPromoted
                  ? 'Esta conversación ya estaba promovida con el mismo contenido.'
                  : 'La conversación se promovió correctamente a The Forge.'}
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
            {successResult.recommendedNextTools?.length ? (
              <div className="rounded-xl border border-[var(--border)] p-3 text-xs">
                <p className="font-medium text-[var(--foreground)]">Siguiente en The Forge</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[var(--foreground-muted)]">
                  {successResult.recommendedNextTools.map((tool) => (
                    <li key={tool}>
                      <code className="font-mono">{tool}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forge-stage-name">Nombre de la etapa</Label>
              <Input
                id="forge-stage-name"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Ej. Reingeniería BD medios"
                disabled={busy}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[var(--foreground)]">Entregables</legend>
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
              {previewStale && !showPreviewProgress ? (
                <>
                  <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
                    Pulsa <strong className="font-medium text-[var(--foreground)]">Aplicar cambios</strong>{' '}
                    para generar la vista previa. Puede tardar varios segundos según el tamaño del chat y los
                    entregables seleccionados.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={chatNavBtnClass}
                    disabled={busy || deliverables.length === 0}
                    onClick={() => void runPreview()}
                  >
                    Aplicar cambios
                  </Button>
                </>
              ) : showPreviewProgress ? (
                <ForgePromoteProgressPanel
                  progress={previewProgress.progress}
                  stepLabel={previewProgress.stepLabel}
                  hint="Analizando la conversación y preparando el plan de modificación."
                />
              ) : preview ? (
                <div className="space-y-2 text-xs">
                  <p>
                    <span className="font-medium">Clave sugerida:</span>{' '}
                    <code className="font-mono">{preview.preview.stageKeySuggested}</code>
                  </p>
                  <p>
                    <span className="font-medium">Mensajes:</span> {preview.preview.messageCount} ·{' '}
                    <span className="font-medium">Archivos en plan:</span>{' '}
                    {preview.preview.modificationPlanFileCount}
                  </p>
                  {preview.preview.warnings.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-4 text-amber-700 dark:text-amber-400">
                      {preview.preview.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  {linkedForgeProjectId ? (
                    <p className="text-[var(--foreground-muted)]">
                      <span className="font-medium text-[var(--foreground)]">Proyecto Forge vinculado:</span>{' '}
                      {linkedForgeProjectName ?? linkedForgeProjectId}{' '}
                      <code className="font-mono text-[10px]">{linkedForgeProjectId}</code>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {candidates?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Proyecto Forge</p>
                <div className="flex flex-wrap gap-2">
                  {candidates.map((c) => (
                    <Button
                      key={c.forgeProjectId}
                      type="button"
                      size="sm"
                      variant={selectedForgeProjectId === c.forgeProjectId ? 'default' : 'outline'}
                      className={chatNavBtnClass}
                      onClick={() => setSelectedForgeProjectId(c.forgeProjectId)}
                    >
                      {c.forgeProjectName}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {showPromoteProgress ? (
              <ForgePromoteProgressPanel
                progress={forgeProgress.progress}
                stepLabel={forgeProgress.stepLabel}
                hint="Puede tardar varios minutos si el plan incluye muchos archivos o tareas LLM."
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
              {candidates?.length && selectedForgeProjectId ? (
                <Button
                  type="button"
                  disabled={!canPromote}
                  onClick={() => void runPromote(selectedForgeProjectId)}
                >
                  {promoteLoading ? 'Enviando…' : 'Confirmar proyecto'}
                </Button>
              ) : (
                <Button type="button" disabled={!canPromote} onClick={() => void runPromote()}>
                  {promoteLoading ? 'Enviando…' : 'Enviar a The Forge'}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChatForgePromoteButton(props: {
  conversationId: string | null;
  disabled?: boolean;
  defaultStageName?: string;
  integrationBatchId?: string | null;
  integrationBatchLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const batchMode = Boolean(props.integrationBatchId);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(chatNavBtnClass, 'gap-2')}
        disabled={(!props.conversationId && !batchMode) || props.disabled}
        onClick={() => setOpen(true)}
        title={batchMode ? 'Promover lote de integración a The Forge' : 'Promover conversación a The Forge'}
      >
        <Hammer className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{batchMode ? 'The Forge (lote)' : 'The Forge'}</span>
      </Button>
      {batchMode && props.integrationBatchId ? (
        <ChatIntegrationBatchForgeDialog
          batchId={props.integrationBatchId}
          batchLabel={props.integrationBatchLabel}
          open={open}
          onOpenChange={setOpen}
          disabled={props.disabled}
        />
      ) : (
        <ChatForgePromoteDialog
          conversationId={props.conversationId}
          open={open}
          onOpenChange={setOpen}
          disabled={props.disabled}
          defaultStageName={props.defaultStageName}
        />
      )}
    </>
  );
}
