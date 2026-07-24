/**
 * Crear etapa en The Forge desde proyecto vinculado (genera descripción + # Tasks).
 */
import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Hammer } from 'lucide-react';
import { api } from '@/api';
import type { CreateProjectTheForgeStageResponse, ProjectTheForgeStagePreview } from '@/types';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export function ProjectTheForgeStageDialog(props: {
  projectId: string;
  forgeProjectName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultChangeDescription?: string;
  defaultStageName?: string;
}) {
  const [stageName, setStageName] = useState('');
  const [changeDescription, setChangeDescription] = useState('');
  const [preview, setPreview] = useState<ProjectTheForgeStagePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateProjectTheForgeStageResponse | null>(null);
  const [activeDoc, setActiveDoc] = useState<'work' | 'tasks'>('tasks');

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setSuccess(null);
    setPreviewLoading(false);
    setCreating(false);
  }, []);

  useEffect(() => {
    if (!props.open) {
      reset();
      return;
    }
    setStageName(props.defaultStageName?.trim() || '');
    setChangeDescription(props.defaultChangeDescription?.trim() || '');
    setActiveDoc('tasks');
  }, [props.open, props.defaultChangeDescription, props.defaultStageName, reset]);

  const runPreview = useCallback(async () => {
    const desc = changeDescription.trim();
    if (desc.length < 20) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await api.previewProjectTheForgeStage(props.projectId, {
        stageName: stageName.trim() || 'Nueva etapa',
        changeDescription: desc,
      });
      setPreview(res);
      if (!stageName.trim() && res.stageName) setStageName(res.stageName);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }, [props.projectId, stageName, changeDescription]);

  useEffect(() => {
    if (!props.open) return;
    const timer = window.setTimeout(() => void runPreview(), 600);
    return () => window.clearTimeout(timer);
  }, [props.open, stageName, changeDescription, runPreview]);

  const handleCreate = async () => {
    const name = stageName.trim();
    const desc = changeDescription.trim();
    if (!name) {
      setError('Indica un nombre para la etapa.');
      return;
    }
    if (desc.length < 20) {
      setError('Describe el cambio (mínimo ~20 caracteres).');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await api.createProjectTheForgeStage(props.projectId, {
        stageName: name,
        changeDescription: desc,
        activate: true,
      });
      setSuccess(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const copyDoc = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const docText =
    activeDoc === 'work'
      ? preview?.changeWorkDescription ?? success?.changeWorkDescription ?? ''
      : preview?.cursorTasksMarkdown ?? success?.cursorTasksMarkdown ?? '';

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="size-5" aria-hidden />
            Crear etapa en The Forge
          </DialogTitle>
          <DialogDescription>
            Ariadne generará la descripción del trabajo y el documento <code># Tasks</code> (front/back) para Cursor
            {props.forgeProjectName ? ` en «${props.forgeProjectName}»` : ''}.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-2">
            <Alert className="rounded-xl border-[color-mix(in_oklch,var(--primary)_30%,var(--border))]">
              <AlertTitle>Etapa creada</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  <strong>{success.stageName ?? success.stageKey}</strong>
                  {success.stageUrl ? (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        href={success.stageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--primary)] underline"
                      >
                        Abrir en The Forge
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    </>
                  ) : null}
                </p>
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={activeDoc === 'tasks' ? 'default' : 'outline'}
                onClick={() => setActiveDoc('tasks')}
              >
                Tareas Cursor
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeDoc === 'work' ? 'default' : 'outline'}
                onClick={() => setActiveDoc('work')}
              >
                Descripción del trabajo
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyDoc(docText)}>
                <Copy className="mr-1 size-3.5" aria-hidden />
                Copiar
              </Button>
            </div>
            <Textarea
              readOnly
              value={docText}
              className="min-h-[280px] font-mono text-xs"
              aria-label={activeDoc === 'tasks' ? 'Documento de tareas' : 'Descripción del trabajo'}
            />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {error ? (
              <Alert variant="destructive" className="rounded-xl">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="forge-stage-desc">Descripción del cambio</Label>
                <Textarea
                  id="forge-stage-desc"
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                  placeholder="Qué quieres modificar, alcance, restricciones…"
                  className="min-h-[120px] rounded-xl"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="forge-stage-name">Nombre de la etapa</Label>
                <Input
                  id="forge-stage-name"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  placeholder="Ej. Refactor módulo pagos"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            {previewLoading ? (
              <p className="text-sm text-[var(--foreground-muted)]">Generando vista previa…</p>
            ) : preview ? (
              <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[var(--foreground-muted)]">
                    {preview.modificationPlanFileCount} archivos · tareas vía{' '}
                    <code>{preview.cursorTasksSource}</code>
                  </span>
                  {preview.warnings.map((w) => (
                    <span
                      key={w}
                      className="rounded-md bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] px-2 py-0.5 text-xs"
                    >
                      {w}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={activeDoc === 'tasks' ? 'default' : 'outline'}
                    onClick={() => setActiveDoc('tasks')}
                  >
                    # Tasks
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeDoc === 'work' ? 'default' : 'outline'}
                    onClick={() => setActiveDoc('work')}
                  >
                    Descripción
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={docText}
                  className={cn('min-h-[220px] font-mono text-xs')}
                />
              </div>
            ) : changeDescription.trim().length >= 20 ? null : (
              <p className="text-sm text-[var(--foreground-muted)]">
                Escribe la descripción del cambio para generar la vista previa.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {success ? (
            <Button type="button" onClick={() => props.onOpenChange(false)}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating || previewLoading || !preview}
              >
                {creating ? 'Creando etapa…' : 'Crear etapa en The Forge'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
