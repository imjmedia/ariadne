/**
 * Modal para importar handoffs NEW-LEG desde un proyecto NEW de The Forge.
 */
import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { api } from '@/api';
import type { ForgeIntegrationHandoffSource, ImportIntegrationHandoffsResponse } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { chatNavBtnClass } from '../chat/chatShellClasses';

export function ChatIntegrationHandoffImportDialog(props: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (result: ImportIntegrationHandoffsResponse) => void;
}) {
  const [sources, setSources] = useState<ForgeIntegrationHandoffSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportIntegrationHandoffsResponse | null>(null);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.listIntegrationHandoffSources(props.projectId);
      setSources(rows);
      setSelectedId((prev) => prev ?? rows[0]?.forgeProjectId ?? null);
    } catch (e) {
      setSources([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [props.projectId]);

  useEffect(() => {
    if (!props.open) {
      setResult(null);
      setError(null);
      return;
    }
    void loadSources();
  }, [props.open, loadSources]);

  const runImport = async () => {
    if (!selectedId) return;
    setImporting(true);
    setError(null);
    try {
      const imported = await api.importIntegrationHandoffs(props.projectId, selectedId);
      setResult(imported);
      props.onImported?.(imported);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-4 shrink-0" aria-hidden />
            Importar handoffs de integración
          </DialogTitle>
          <DialogDescription>
            Elige un proyecto <strong>NEW</strong> en The Forge. Se creará un chat por cada handoff
            NEW-LEG con status <code className="text-xs">sent</code>, agrupados aparte de tus chats
            generales.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <Alert className="rounded-xl">
              <AlertTitle>Importación completada</AlertTitle>
              <AlertDescription>
                Lote <strong>{result.batchLabel}</strong>: {result.created.length} chat(s) nuevos
                {result.skipped.length > 0 ? `, ${result.skipped.length} omitido(s)` : ''}.
              </AlertDescription>
            </Alert>
            {result.created.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--foreground-muted)]">
                {result.created.map((row) => (
                  <li key={row.conversationId}>
                    <code>{row.handoffId}</code> — {row.title}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {loading ? (
              <p className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Consultando proyectos NEW en The Forge…
              </p>
            ) : sources.length === 0 ? (
              <p className="text-xs text-[var(--foreground-muted)]">
                No hay proyectos NEW con handoffs de integración disponibles.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {sources.map((source) => {
                  const selected = selectedId === source.forgeProjectId;
                  return (
                    <li key={source.forgeProjectId}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(source.forgeProjectId)}
                        className={cn(
                          'w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                          selected
                            ? 'border-[var(--primary)] bg-[var(--secondary)]'
                            : 'border-[var(--border)] hover:bg-[var(--secondary)]/50',
                        )}
                      >
                        <span className="font-medium">{source.forgeProjectName}</span>
                        <span className="mt-1 block text-[10px] text-[var(--foreground-muted)]">
                          {source.sentHandoffCount} handoff(s) sent
                          {source.groupName ? ` · ${source.groupName}` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {error ? (
              <Alert variant="destructive" className="rounded-xl">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {result ? (
            <Button type="button" onClick={() => props.onOpenChange(false)}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className={chatNavBtnClass}
                onClick={() => props.onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!selectedId || importing || loading}
                onClick={() => void runImport()}
              >
                {importing ? 'Importando…' : 'Importar handoffs'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChatIntegrationHandoffImportButton(props: {
  projectId: string;
  disabled?: boolean;
  onImported?: (result: ImportIntegrationHandoffsResponse) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(chatNavBtnClass, 'gap-2')}
        disabled={props.disabled}
        onClick={() => setOpen(true)}
        title="Importar handoffs NEW-LEG desde The Forge"
      >
        <Download className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Handoffs</span>
      </Button>
      <ChatIntegrationHandoffImportDialog
        projectId={props.projectId}
        open={open}
        onOpenChange={setOpen}
        onImported={props.onImported}
      />
    </>
  );
}
