/**
 * Vinculación opcional proyecto Ariadne ↔ The Forge (brownfield LEGACY).
 */
import { useCallback, useEffect, useState } from 'react';
import { Hammer, Link2Off } from 'lucide-react';
import { api } from '@/api';
import type { ForgeBrownfieldProjectOption, Project } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const sectionShellClass = cn(
  'overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm',
);
const sectionHeaderClass = cn(
  'border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_26%,var(--card))]',
  'px-5 py-4 sm:px-6',
);
const selectTriggerClass = cn(
  'h-11 w-full justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 shadow-none',
  'text-left text-sm font-normal text-[var(--foreground)]',
);

export function ProjectTheForgeLinkSection(props: {
  projectId: string;
  theforgeProjectId: string | null | undefined;
  theforgeProjectName: string | null | undefined;
  onLinked: (project: Project) => void;
}) {
  const [forgeEnabled, setForgeEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [options, setOptions] = useState<ForgeBrownfieldProjectOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChecking(true);
    api
      .getTheForgeIntegrationStatus()
      .then((s) => setForgeEnabled(Boolean(s.enabled && (s.chatPromotionAvailable || s.mock))))
      .catch(() => setForgeEnabled(false))
      .finally(() => setChecking(false));
  }, []);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError(null);
    try {
      const res = await api.listTheForgeBrownfieldProjects();
      setOptions(res.projects);
      if (res.projects.length === 1) setSelectedId(res.projects[0].id);
    } catch (e) {
      setOptions([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    setSelectedId(props.theforgeProjectId ?? '');
    void loadOptions();
  }, [dialogOpen, loadOptions, props.theforgeProjectId]);

  const handleLink = async () => {
    if (!selectedId) {
      setError('Selecciona un proyecto brownfield de The Forge.');
      return;
    }
    const picked = options.find((o) => o.id === selectedId);
    setSaving(true);
    setError(null);
    try {
      const updated = await api.linkProjectToTheForge(props.projectId, {
        forgeProjectId: selectedId,
        forgeProjectName: picked?.name,
      });
      props.onLinked(updated);
      setDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (
      !window.confirm(
        '¿Desvincular este proyecto Ariadne de The Forge?\n\nLos repos del proyecto dejarán de tener el UUID de Forge para converge automático.',
      )
    ) {
      return;
    }
    setUnlinking(true);
    setError(null);
    try {
      const updated = await api.unlinkProjectFromTheForge(props.projectId);
      props.onLinked(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUnlinking(false);
    }
  };

  if (checking || !forgeEnabled) return null;

  const linked = Boolean(props.theforgeProjectId?.trim());

  return (
    <>
      <section className={sectionShellClass} aria-labelledby="project-forge-link-heading">
        <div className={sectionHeaderClass}>
          <h2
            id="project-forge-link-heading"
            className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]"
          >
            <Hammer className="size-5 shrink-0 text-[var(--foreground-muted)]" aria-hidden />
            The Forge
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)] sm:text-sm">
            Vincula este proyecto Ariadne con un proyecto brownfield (LEGACY) en The Forge para promoción de chat,
            converge y flujos legacy.
          </p>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          {error && !dialogOpen ? (
            <Alert variant="destructive" className="rounded-xl">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {linked ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {props.theforgeProjectName?.trim() || 'Proyecto The Forge vinculado'}
                </p>
                <code className="block truncate rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_30%,var(--card))] px-2 py-1 font-mono text-xs text-[var(--foreground-muted)]">
                  {props.theforgeProjectId}
                </code>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl"
                  onClick={() => setDialogOpen(true)}
                  disabled={unlinking}
                >
                  Cambiar vínculo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl text-[var(--destructive)] hover:bg-[color-mix(in_oklch,var(--destructive)_10%,var(--card))]"
                  onClick={() => void handleUnlink()}
                  disabled={unlinking}
                >
                  <Link2Off className="mr-1.5 size-4" aria-hidden />
                  {unlinking ? 'Desvinculando…' : 'Desvincular'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--foreground-muted)]">
                Sin vínculo con The Forge. Puedes asociar un proyecto brownfield existente.
              </p>
              <Button type="button" className="h-11 shrink-0 rounded-xl" onClick={() => setDialogOpen(true)}>
                Vincular a proyecto The Forge
              </Button>
            </div>
          )}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-[var(--border)]">
          <DialogHeader>
            <DialogTitle>Vincular a proyecto The Forge</DialogTitle>
            <DialogDescription>
              Elige un proyecto brownfield (LEGACY) registrado en The Forge. El UUID se guardará en este proyecto y en
              sus repositorios asociados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {error ? (
              <Alert variant="destructive" className="rounded-xl">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="forge-project-select">Proyecto brownfield</Label>
              {loadingOptions ? (
                <p className="text-sm text-[var(--foreground-muted)]">Cargando proyectos…</p>
              ) : options.length === 0 ? (
                <p className="text-sm text-[var(--foreground-muted)]">
                  No hay proyectos LEGACY en The Forge o no se pudo consultar la API.
                </p>
              ) : (
                <Select value={selectedId || undefined} onValueChange={setSelectedId}>
                  <SelectTrigger id="forge-project-select" className={selectTriggerClass}>
                    <SelectValue placeholder="Selecciona un proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                        {opt.groupName ? ` · ${opt.groupName}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleLink()} disabled={saving || loadingOptions || !selectedId}>
              {saving ? 'Guardando…' : 'Vincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
