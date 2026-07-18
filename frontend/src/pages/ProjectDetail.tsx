/**
 * @fileoverview Detalle de proyecto: nombre, lista de repos, enlaces a chat/índice, añadir repo (nuevo o existente).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Domain, Project, Repository } from '../types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { useActiveSyncJobStatuses } from '@/lib/useActiveSyncJobStatuses';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2Off, Pencil, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ArchitecturePanel } from './ProjectDetail/ArchitecturePanel';

const panelIntroClass = cn(
  'rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

const sectionShellClass = cn(
  'overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

const sectionHeaderClass = cn(
  'border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_26%,var(--card))]',
  'px-5 py-4 sm:px-6',
);

const selectTriggerClass = cn(
  'h-11 w-full min-w-[220px] max-w-md justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 shadow-none',
  'text-left text-sm font-normal text-[var(--foreground)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]',
);

const tabListClass = cn(
  'inline-flex w-full max-w-md gap-1 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] p-1 sm:w-auto',
);

const monoFieldClass = cn(
  'inline-flex min-h-9 max-w-full cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))]',
  'px-3 py-1.5 font-mono text-xs text-[var(--foreground)] shadow-none transition-colors hover:bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]',
);

const tabPillActiveClass =
  'bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]/80';
const tabPillInactiveClass = 'text-[var(--foreground-muted)] hover:bg-[var(--card)]/40 hover:text-[var(--foreground)]';

/** Modal para asociar un repo existente al proyecto. Extraído para reducir anidamiento en ProjectDetail. */
function AssociateRepoDialog({
  open,
  onOpenChange,
  loadingRepos,
  associateError,
  associateSuccess,
  associatingId,
  availableRepos,
  onAssociate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadingRepos: boolean;
  associateError: string | null;
  associateSuccess: string | null;
  associatingId: string | null;
  availableRepos: Repository[];
  onAssociate: (repoId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[min(90vh,640px)] w-[calc(100%-1.5rem)] max-w-md gap-0 overflow-hidden p-0 sm:max-w-md',
          'border-[var(--border)] bg-[var(--card)]',
        )}
      >
        <div className="border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-6 py-4 pr-12">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-lg font-semibold">Asociar repositorio existente</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-[var(--foreground-muted)]">
              Elige un repo ya dado de alta en Ariadne. Se asociará a este proyecto sin crear otro webhook; seguirá
              sincronizándose con el mismo.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {associateError ? (
            <Alert variant="destructive" className="rounded-xl">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{associateError}</AlertDescription>
            </Alert>
          ) : null}
          {associateSuccess ? (
            <Alert className="rounded-xl border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50">
              <AlertTitle className="text-sm">Hecho</AlertTitle>
              <AlertDescription>{associateSuccess}</AlertDescription>
            </Alert>
          ) : null}
          {loadingRepos ? (
            <div className="py-8 text-center text-sm text-[var(--foreground-muted)]">Cargando repositorios…</div>
          ) : availableRepos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_30%,transparent)] px-4 py-6 text-sm text-[var(--foreground-muted)]">
              No hay repositorios disponibles para asociar (todos están ya en este proyecto o no hay otros
              registrados).
            </p>
          ) : (
            <ul className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
              {availableRepos.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))] px-3 py-2.5"
                >
                  <span className="truncate text-sm font-medium text-[var(--foreground)]">
                    {r.projectKey}/{r.repoSlug}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 shrink-0 rounded-lg"
                    onClick={() => onAssociate(r.id)}
                    disabled={associatingId !== null}
                  >
                    {associatingId === r.id ? 'Asociando…' : 'Asociar'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter showCloseButton className="border-t border-[var(--border)] px-6 py-3" />
      </DialogContent>
    </Dialog>
  );
}

/** Card de descripción editable. */
function ProjectDetailDescriptionCard({
  description,
  editingDescription,
  descriptionDraft,
  savingDescription,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSave,
}: {
  description: string | null;
  editingDescription: boolean;
  descriptionDraft: string;
  savingDescription: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <section className={sectionShellClass} aria-labelledby="project-desc-heading">
      <div className={sectionHeaderClass}>
        <h2 id="project-desc-heading" className="text-base font-semibold text-[var(--foreground)]">
          Descripción
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)] sm:text-sm">
          Ej.: solo ramas main, mixto (varias ramas), convenciones del equipo, etc.
        </p>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {editingDescription ? (
          <div className="space-y-4">
            <Textarea
              value={descriptionDraft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="Ej.: Repositorios en rama main. / Proyecto mixto: front en main, back en develop."
              rows={4}
              className={cn(
                'min-h-[6.5rem] w-full resize-y rounded-xl border-[var(--border)] bg-[var(--card)] text-sm',
                'focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]',
              )}
            />
            <div className="flex flex-wrap gap-2">
              <Button className="h-11 rounded-xl" onClick={onSave} disabled={savingDescription}>
                {savingDescription ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" onClick={onCancelEdit} disabled={savingDescription}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <p className="min-h-[1.5rem] flex-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground-muted)]">
              {description || 'Sin descripción.'}
            </p>
            <Button
              variant="outline"
              className="h-10 shrink-0 self-start rounded-xl border-[var(--border)] px-4 sm:self-auto"
              onClick={onStartEdit}
            >
              {description ? 'Editar' : 'Añadir descripción'}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Página de detalle de proyecto: nombre, descripción, lista de repos, asociar repo, sync y eliminación.
 * Refactor: AssociateRepoDialog y ProjectDetailDescriptionCard extraídos para reducir anidamiento.
 */
export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [associateDialogOpen, setAssociateDialogOpen] = useState(false);
  const [allRepos, setAllRepos] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [associatingId, setAssociatingId] = useState<string | null>(null);
  const [associateError, setAssociateError] = useState<string | null>(null);
  const [associateSuccess, setAssociateSuccess] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [regeneratingProjectId, setRegeneratingProjectId] = useState(false);
  const [resyncProjectBusy, setResyncProjectBusy] = useState(false);
  const [roleSavingRepoId, setRoleSavingRepoId] = useState<string | null>(null);
  const [detachingRepoId, setDetachingRepoId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'general' | 'architecture'>('general');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [savingDomain, setSavingDomain] = useState(false);
  const [refreshingProject, setRefreshingProject] = useState(false);
  const {
    displayStatus,
    refresh: refreshActiveJobs,
    setOptimistic,
    hasActiveJobs,
  } = useActiveSyncJobStatuses({ enabled: Boolean(id) });

  const fetchProject = useCallback((): Promise<void> => {
    if (!id) return Promise.resolve();
    return api
      .getProject(id)
      .then((projectData) => {
        setProject(projectData);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void fetchProject().finally(() => setLoading(false));
  }, [id, fetchProject]);

  useEffect(() => {
    if (!hasActiveJobs || !id) return;
    const t = setInterval(() => {
      void fetchProject();
    }, 2000);
    return () => clearInterval(t);
  }, [hasActiveJobs, id, fetchProject]);

  const handleRefreshProject = useCallback(() => {
    if (!id) return;
    setRefreshingProject(true);
    void fetchProject().finally(() => setRefreshingProject(false));
  }, [id, fetchProject]);

  useEffect(() => {
    api
      .getDomains()
      .then(setDomains)
      .catch(() => setDomains([]));
  }, []);

  useEffect(() => {
    if (associateDialogOpen && id) {
      setLoadingRepos(true);
      setAssociateError(null);
      setAssociateSuccess(null);
      api
        .getRepositories()
        .then(setAllRepos)
        .catch((e) => setAssociateError(e.message))
        .finally(() => setLoadingRepos(false));
    }
  }, [associateDialogOpen, id]);

  const availableRepos = project
    ? allRepos.filter((r) => !project.repositories.some((pr) => pr.id === r.id))
    : [];

  /**
   * Encola resync-for-project para **todos** los repos del proyecto (mismo efecto desde cualquier fila).
   * Cada job borra el slice (projectId, repoId) en Falkor y reindexa solo ese proyecto para ese repo.
   */
  const resyncEntireProject = async () => {
    if (!id || !project?.repositories.length) return;
    setResyncProjectBusy(true);
    setError(null);
    for (const r of project.repositories) {
      setOptimistic(r.id, 'queued');
    }
    try {
      await Promise.all(project.repositories.map((r) => api.resyncForProject(r.id, id)));
      await refreshActiveJobs();
      await fetchProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al encolar resync del proyecto');
    } finally {
      setResyncProjectBusy(false);
    }
  };

  /** Persiste `project_repositories.role` (inferencia de alcance en chat multi-root). */
  const saveRepoRole = async (repoId: string, value: string) => {
    if (!id) return;
    const role = value.trim() || null;
    setRoleSavingRepoId(repoId);
    setError(null);
    try {
      await api.setProjectRepositoryRole(id, repoId, role);
      setProject((prev) =>
        prev
          ? {
              ...prev,
              repositories: prev.repositories.map((r) => (r.id === repoId ? { ...r, role } : r)),
            }
          : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar rol');
    } finally {
      setRoleSavingRepoId(null);
    }
  };

  /** Quita el repo de este proyecto (no borra el registro en /repositorios). */
  const detachRepo = async (repo: { id: string; projectKey: string; repoSlug: string }) => {
    if (!id) return;
    const label = `${repo.projectKey}/${repo.repoSlug}`;
    if (
      !window.confirm(
        `¿Quitar "${label}" de este proyecto?\n\nSe eliminará su índice en el grafo de este proyecto. El repositorio seguirá existiendo en Ariadne y podrás volver a asociarlo.`,
      )
    ) {
      return;
    }
    setDetachingRepoId(repo.id);
    setError(null);
    try {
      await api.detachProjectRepository(id, repo.id);
      await fetchProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al desasociar el repositorio');
    } finally {
      setDetachingRepoId(null);
    }
  };

  /** Asocia un repo al proyecto (PATCH projectId), dispara sync y recarga. */
  const associateRepo = async (repoId: string) => {
    if (!id) return;
    setAssociatingId(repoId);
    setAssociateError(null);
    setAssociateSuccess(null);
    try {
      await api.updateRepository(repoId, { projectId: id });
      await api.triggerSync(repoId);
      fetchProject();
      const repo = allRepos.find((r) => r.id === repoId);
      setAssociateSuccess(
        repo
          ? `${repo.projectKey}/${repo.repoSlug} asociado. Se encoló un sync para indexarlo en este proyecto (se conserva también el índice del repo en solitario).`
          : 'Repo asociado. Sync encolado; se conserva el índice standalone y se añade al proyecto.',
      );
    } catch (e) {
      setAssociateError(e instanceof Error ? e.message : 'Error al asociar');
    } finally {
      setAssociatingId(null);
    }
  };

  /** Activa modo edición de descripción con el valor actual. */
  const startEditDescription = () => {
    setDescriptionDraft(project?.description ?? '');
    setEditingDescription(true);
  };

  /** Sale del modo edición de descripción sin guardar. */
  const cancelEditDescription = () => {
    setEditingDescription(false);
    setDescriptionDraft('');
  };

  /** Regenera el ID del proyecto y redirige al nuevo. */
  const regenerateProjectId = async () => {
    if (!id) return;
    if (
      !window.confirm(
        '¿Regenerar el ID del proyecto? Se creará un nuevo UUID. Los repos y el índice se conservan. Serás redirigido al proyecto actualizado.',
      )
    ) {
      return;
    }
    setRegeneratingProjectId(true);
    try {
      const { newProjectId } = await api.regenerateProjectId(id);
      navigate(`/projects/${newProjectId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al regenerar ID');
    } finally {
      setRegeneratingProjectId(false);
    }
  };

  /** Elimina el proyecto (DELETE /projects/:id) tras confirmar; redirige a /. */
  const deleteProject = async () => {
    if (!id || !project) return;
    const name =
      project.name || project.repositories[0]?.projectKey + '/' + project.repositories[0]?.repoSlug || id.slice(0, 8);
    const n = project.repositories.length;
    const msg =
      n > 0
        ? `¿Eliminar el proyecto "${name}"? Los ${n} repositorio(s) no se borrarán, solo quedarán sin proyecto (podrás asociarlos a otro después).`
        : `¿Eliminar el proyecto "${name}"?`;
    if (!window.confirm(msg)) return;
    setDeletingProject(true);
    try {
      await api.deleteProject(id);
      navigate('/projects', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeletingProject(false);
    }
  };

  /** Guarda descripción con PATCH /projects/:id y cierra modo edición. */
  const saveDescription = async () => {
    if (!id || !project) return;
    setSavingDescription(true);
    try {
      await api.updateProject(id, { description: descriptionDraft.trim() || null });
      setProject((prev) => (prev ? { ...prev, description: descriptionDraft.trim() || null } : null));
      setEditingDescription(false);
      setDescriptionDraft('');
    } finally {
      setSavingDescription(false);
    }
  };

  /** Activa modo edición de nombre con valor actual (nombre o primer repo). */
  const startEditName = () => {
    if (!project || !id) return;
    const first = project.repositories[0];
    const current =
      project.name?.trim() ||
      (first ? `${first.projectKey}/${first.repoSlug}` : '') ||
      id.slice(0, 8) ||
      '';
    setNameDraft(current);
    setEditingName(true);
  };

  const saveProjectDomain = async (domainId: string | null) => {
    if (!id) return;
    setSavingDomain(true);
    setError(null);
    try {
      await api.updateProject(id, { domainId });
      await fetchProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar dominio');
    } finally {
      setSavingDomain(false);
    }
  };

  /** Guarda nombre con PATCH /projects/:id y cierra modo edición. */
  const saveName = async () => {
    if (!id || !project) return;
    const trimmed = nameDraft.trim();
    setSavingName(true);
    try {
      await api.updateProject(id, { name: trimmed || null });
      setProject((prev) => (prev ? { ...prev, name: trimmed || null } : null));
      setEditingName(false);
      setNameDraft('');
    } finally {
      setSavingName(false);
    }
  };

  if (!id) return null;
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-10">
        <div className={tabListClass} aria-hidden>
          <Skeleton className="h-10 flex-1 rounded-xl sm:flex-none sm:w-28" />
          <Skeleton className="h-10 flex-1 rounded-xl sm:flex-none sm:w-36" />
        </div>
        <div className={panelIntroClass}>
          <Skeleton className="h-9 w-2/3 max-w-md" />
          <Skeleton className="mt-4 h-4 w-48" />
          <Skeleton className="mt-6 h-11 w-full max-w-lg" />
        </div>
        <div className={sectionShellClass}>
          <div className={sectionHeaderClass}>
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="space-y-3 p-6">
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-10">
        <div className={panelIntroClass}>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Proyecto</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
            No se pudo cargar el proyecto o no existe.
          </p>
        </div>
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Proyecto no encontrado'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const firstRepo = project.repositories[0];
  const displayName =
    (project.name && project.name.trim()) ||
    (firstRepo ? `${firstRepo.projectKey}/${firstRepo.repoSlug}` : '') ||
    id.slice(0, 8);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <nav className={tabListClass} aria-label="Secciones del proyecto">
        <button
          type="button"
          onClick={() => setDetailTab('general')}
          className={cn(
            'flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:min-w-[8rem]',
            detailTab === 'general' ? tabPillActiveClass : tabPillInactiveClass,
          )}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setDetailTab('architecture')}
          className={cn(
            'flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:min-w-[9rem]',
            detailTab === 'architecture' ? tabPillActiveClass : tabPillInactiveClass,
          )}
        >
          Arquitectura
        </button>
      </nav>

      <AssociateRepoDialog
        open={associateDialogOpen}
        onOpenChange={setAssociateDialogOpen}
        loadingRepos={loadingRepos}
        associateError={associateError}
        associateSuccess={associateSuccess}
        associatingId={associatingId}
        availableRepos={availableRepos}
        onAssociate={associateRepo}
      />

      {error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {detailTab === 'architecture' && id ? (
        <ArchitecturePanel
          project={project}
          projectId={id}
          onProjectUpdated={() => {
            void fetchProject();
          }}
        />
      ) : null}

      {detailTab === 'general' ? (
        <div className="space-y-6">
          <div className={panelIntroClass}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {editingName ? (
                  <Input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveName();
                      if (e.key === 'Escape') {
                        setEditingName(false);
                        setNameDraft('');
                      }
                    }}
                    onBlur={() => void saveName()}
                    disabled={savingName}
                    className="h-11 max-w-xl rounded-xl border-[var(--border)] bg-[var(--card)] text-xl font-bold tracking-tight text-[var(--foreground)]"
                    autoFocus
                  />
                ) : (
                  <>
                    <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                      {displayName}
                    </h1>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10 shrink-0 rounded-xl border-[var(--border)]"
                      onClick={startEditName}
                      title="Editar nombre del proyecto"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </>
                )}
              </div>
              <p className="text-sm text-[var(--foreground-muted)]">
                {project.repositories.length} repositorio{project.repositories.length !== 1 ? 's' : ''} en este
                proyecto
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-[var(--foreground-muted)]">ID (MCP)</span>
                <code
                  role="button"
                  tabIndex={0}
                  onClick={() => void navigator.clipboard.writeText(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void navigator.clipboard.writeText(id);
                  }}
                  title="Clic para copiar"
                  className={cn(monoFieldClass, 'select-text')}
                >
                  {id}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 rounded-xl border-[var(--border)]"
                  onClick={regenerateProjectId}
                  disabled={regeneratingProjectId}
                  title="Regenerar ID del proyecto (sin perder datos)"
                >
                  <RefreshCw className={`size-4 ${regeneratingProjectId ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 rounded-xl border-[var(--border)]"
                onClick={handleRefreshProject}
                disabled={refreshingProject}
                title="Recargar datos del proyecto"
              >
                <RefreshCw className={`size-4 ${refreshingProject ? 'animate-spin' : ''}`} />
              </Button>
              <Button className="h-11 rounded-xl" asChild>
                <Link to={`/projects/${id}/chat`}>Chat (proyecto)</Link>
              </Button>
              <Button className="h-11 rounded-xl" variant="outline" asChild>
                <Link to={`/repos?openCreate=1&projectId=${id}`}>Repositorio nuevo</Link>
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl"
                variant="outline"
                onClick={() => setAssociateDialogOpen(true)}
              >
                Asociar repo existente
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl"
                variant="destructive"
                onClick={deleteProject}
                disabled={deletingProject}
                title="Eliminar proyecto; los repos quedarán sin proyecto"
              >
                {deletingProject ? 'Eliminando…' : 'Eliminar proyecto'}
              </Button>
            </div>
          </div>

          <ProjectDetailDescriptionCard
            description={project.description}
            editingDescription={editingDescription}
            descriptionDraft={descriptionDraft}
            savingDescription={savingDescription}
            onStartEdit={startEditDescription}
            onCancelEdit={cancelEditDescription}
            onDraftChange={setDescriptionDraft}
            onSave={saveDescription}
          />

          <section className={sectionShellClass} aria-labelledby="project-domain-heading">
            <div className={sectionHeaderClass}>
              <h2 id="project-domain-heading" className="text-base font-semibold text-[var(--foreground)]">
                Dominio (gobierno de arquitectura)
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)] sm:text-sm">
                FK estructural en BD: el proyecto pertenece a un dominio. Afecta coloración, whitelist de grafos y
                visibilidad entre dominios.
              </p>
            </div>
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:px-6 sm:py-6">
              <div className="min-w-0 space-y-2 sm:min-w-[220px]">
                <Label htmlFor="proj-domain" className="text-xs font-medium text-[var(--foreground-muted)]">
                  Dominio
                </Label>
                <Select
                  value={project.domainId ?? '__none__'}
                  onValueChange={(v) => void saveProjectDomain(v === '__none__' ? null : v)}
                  disabled={savingDomain || domains.length === 0}
                >
                  <SelectTrigger id="proj-domain" className={selectTriggerClass}>
                    <SelectValue placeholder={domains.length === 0 ? 'Crea dominios primero' : 'Sin dominio'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(ninguno)</SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block size-3 rounded border"
                            style={{ backgroundColor: d.color }}
                          />
                          {d.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="link"
                className="h-auto self-center px-0 text-sm font-medium text-[var(--foreground)] underline-offset-4 hover:underline sm:self-auto"
                asChild
              >
                <Link to="/domains">Gestionar dominios</Link>
              </Button>
            </div>
          </section>

          <section className={sectionShellClass} aria-labelledby="project-repos-heading">
            <div className={sectionHeaderClass}>
              <h2 id="project-repos-heading" className="text-base font-semibold text-[var(--foreground)]">
                Repositorios
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)] sm:text-sm">
                Chat, índice y análisis por repo; grafo común al proyecto. Rol (p. ej. frontend, backend): inferencia
                de alcance en chat multi-root.
              </p>
            </div>
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              {project.repositories.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_18%,var(--card))] px-4 py-10 text-center">
                  <p className="max-w-md text-sm text-[var(--foreground-muted)]">
                    Sin repositorios. Añade uno nuevo o asocia uno ya registrado.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button className="h-11 rounded-xl" asChild>
                      <Link to={`/repos?openCreate=1&projectId=${id}`}>Repositorio nuevo</Link>
                    </Button>
                    <Button
                      type="button"
                      className="h-11 rounded-xl"
                      variant="outline"
                      onClick={() => setAssociateDialogOpen(true)}
                    >
                      Asociar repo existente
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[var(--border)] hover:bg-transparent">
                        <TableHead className="text-[var(--foreground-muted)]">Repo</TableHead>
                        <TableHead className="min-w-[8rem] text-[var(--foreground-muted)]">Rol (chat)</TableHead>
                        <TableHead className="text-[var(--foreground-muted)]">Rama</TableHead>
                        <TableHead className="text-[var(--foreground-muted)]">Estado</TableHead>
                        <TableHead className="text-[var(--foreground-muted)]">Último sync</TableHead>
                        <TableHead className="text-right text-[var(--foreground-muted)]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.repositories.map((r) => (
                        <TableRow key={r.id} className="border-[var(--border)]">
                          <TableCell>
                            <Link
                              to={`/repos/${r.id}`}
                              className="font-medium text-[var(--foreground)] hover:underline"
                            >
                              {r.projectKey}/{r.repoSlug}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Input
                              key={`${r.id}-${r.role ?? ''}`}
                              className="h-10 max-w-[10rem] rounded-xl border-[var(--border)] bg-[var(--card)] text-xs font-mono"
                              placeholder="p. ej. frontend"
                              defaultValue={r.role ?? ''}
                              disabled={roleSavingRepoId === r.id}
                              onBlur={(e) => {
                                const v = e.target.value;
                                if ((v.trim() || '') === (r.role ?? '')) return;
                                void saveRepoRole(r.id, v);
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm text-[var(--foreground-muted)]">
                            {r.defaultBranch || '—'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={displayStatus(r.id, r.status)} />
                          </TableCell>
                          <TableCell className="text-[var(--foreground-muted)]">
                            {r.lastSyncAt ? new Date(r.lastSyncAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                                onClick={() => void resyncEntireProject()}
                                disabled={resyncProjectBusy}
                                title="Reindexar todos los repositorios de este proyecto en Falkor (desde cualquier fila)"
                              >
                                {resyncProjectBusy ? 'Encolando…' : 'Resync (proyecto)'}
                              </Button>
                              <Button variant="outline" size="sm" className="rounded-lg" asChild>
                                <Link to={`/repos/${r.id}/chat`}>Chat (repo)</Link>
                              </Button>
                              <Button variant="outline" size="sm" className="rounded-lg" asChild>
                                <Link to={`/repos/${r.id}`}>Detalle</Link>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-lg text-[var(--destructive)] hover:bg-[color-mix(in_oklch,var(--destructive)_12%,var(--card))]"
                                disabled={detachingRepoId === r.id}
                                title="Quitar del proyecto (no elimina el repositorio)"
                                onClick={() => void detachRepo(r)}
                              >
                                <Link2Off className="mr-1 inline size-3.5" aria-hidden />
                                {detachingRepoId === r.id ? 'Quitando…' : 'Quitar'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
