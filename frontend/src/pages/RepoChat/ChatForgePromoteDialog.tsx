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

export function ChatForgePromoteDialog(props: {
  conversationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  defaultStageName?: string;
  onSuccess?: (result: PromoteToTheForgeResponse) => void;
}) {
  const [stageName, setStageName] = useState('');
  const [deliverables, setDeliverables] = useState<ForgeDeliverableKind[]>(DEFAULT_DELIVERABLES);
  const [preview, setPreview] = useState<PreviewTheForgePackResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ForgeProjectCandidate[] | null>(null);
  const [selectedForgeProjectId, setSelectedForgeProjectId] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<PromoteToTheForgeResponse | null>(null);

  const resetState = useCallback(() => {
    setPreview(null);
    setError(null);
    setCandidates(null);
    setSelectedForgeProjectId(null);
    setSuccessResult(null);
    setPreviewLoading(false);
    setPromoteLoading(false);
  }, []);

  useEffect(() => {
    if (!props.open) {
      resetState();
      return;
    }
    setStageName(props.defaultStageName?.trim() || '');
    setDeliverables(DEFAULT_DELIVERABLES);
  }, [props.open, props.defaultStageName, resetState]);

  const runPreview = useCallback(async () => {
    if (!props.conversationId) return;
    setPreviewLoading(true);
    setError(null);
    setCandidates(null);
    try {
      const res = await api.previewTheForgePack(props.conversationId, {
        stageName: stageName.trim() || undefined,
        deliverables,
      });
      setPreview(res);
      if (!stageName.trim() && res.preview.changeTitle) {
        setStageName(res.preview.changeTitle);
      }
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }, [props.conversationId, stageName, deliverables]);

  useEffect(() => {
    if (!props.open || !props.conversationId) return;
    const timer = window.setTimeout(() => {
      void runPreview();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [props.open, props.conversationId, stageName, deliverables, runPreview]);

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
    setError(null);
    try {
      const result = await api.promoteConversationToTheForge(props.conversationId, {
        stageName: name,
        stageKey: preview?.preview.stageKeySuggested,
        deliverables,
        activate: false,
        ...(forgeProjectId ? { forgeProjectId } : {}),
      });
      setSuccessResult(result);
      props.onSuccess?.(result);
    } catch (e) {
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
    } finally {
      setPromoteLoading(false);
    }
  };

  const busy = previewLoading || promoteLoading;
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
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background-muted)]/40 p-3 text-xs">
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
              </div>
            ) : null}

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
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(chatNavBtnClass, 'gap-2')}
        disabled={!props.conversationId || props.disabled}
        onClick={() => setOpen(true)}
        title="Promover conversación a The Forge"
      >
        <Hammer className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">The Forge</span>
      </Button>
      <ChatForgePromoteDialog
        conversationId={props.conversationId}
        open={open}
        onOpenChange={setOpen}
        disabled={props.disabled}
        defaultStageName={props.defaultStageName}
      />
    </>
  );
}
