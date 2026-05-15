import { useState } from 'react';
import { History } from 'lucide-react';
import type { SyncJob } from '../../types';
import { Button } from '@/components/ui/button';
import { JobAnalysisModal } from './JobAnalysisModal';
import { SkippedFilesModal } from './SkippedFilesModal';
import { IndexedFilesModal } from './IndexedFilesModal';
import { SyncPipelineModal } from './SyncPipelineModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { formatJobPayload } from './utils';
import { cn } from '@/lib/utils';
import { sectionHeaderClass, sectionShellClass } from './layoutClasses';

interface RepoDetailJobsCardProps {
  repoId: string | undefined;
  /** Proyecto Ariadne (opcional): análisis de job vía ruta por proyecto. */
  projectId: string | null;
  jobs: SyncJob[];
  selectedJobIds: Set<string>;
  deletingJobs: boolean;
  toggleJobSelection: (jobId: string) => void;
  toggleAllJobs: () => void;
  onDeleteJob: (jobId: string) => void;
  onDeleteSelectedJobs: () => void;
  onDeleteAllJobs: () => void;
  analysisJobId: string | null;
  analysisModalOpen: boolean;
  onAnalyzeJob: (jobId: string) => void;
  setAnalysisModalOpen: (open: boolean) => void;
}

const toolbarButtonClass = 'h-10 rounded-xl';

/** Jobs history: toolbar, table or empty state, modals for analysis / files / pipeline. */
export function RepoDetailJobsCard({
  repoId,
  projectId,
  jobs,
  selectedJobIds,
  deletingJobs,
  toggleJobSelection,
  toggleAllJobs,
  onDeleteJob,
  onDeleteSelectedJobs,
  onDeleteAllJobs,
  analysisJobId,
  analysisModalOpen,
  onAnalyzeJob,
  setAnalysisModalOpen,
}: RepoDetailJobsCardProps) {
  const [skippedModalJobId, setSkippedModalJobId] = useState<string | null>(null);
  const [indexedModalJobId, setIndexedModalJobId] = useState<string | null>(null);
  const [pipelineModalJobId, setPipelineModalJobId] = useState<string | null>(null);
  const hasSelection = selectedJobIds.size > 0;
  const allSelected = jobs.length > 0 && selectedJobIds.size === jobs.length;

  return (
    <section className={sectionShellClass} aria-labelledby="repo-jobs-heading">
      <div className={cn(sectionHeaderClass, 'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between')}>
        <div className="min-w-0">
          <h2 id="repo-jobs-heading" className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Jobs
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">
            Historial de sincronizaciones
          </p>
        </div>
        {jobs.length > 0 ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {hasSelection ? (
              <Button
                type="button"
                variant="destructive"
                className={toolbarButtonClass}
                onClick={onDeleteSelectedJobs}
                disabled={deletingJobs}
              >
                Borrar ({selectedJobIds.size})
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={cn(toolbarButtonClass, 'border-[var(--border)]')}
              onClick={onDeleteAllJobs}
              disabled={deletingJobs}
            >
              Borrar todos
            </Button>
          </div>
        ) : null}
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <JobsTable
          jobs={jobs}
          selectedJobIds={selectedJobIds}
          allSelected={allSelected}
          deletingJobs={deletingJobs}
          toggleJobSelection={toggleJobSelection}
          toggleAllJobs={toggleAllJobs}
          onDeleteJob={onDeleteJob}
          onAnalyzeJob={onAnalyzeJob}
          onShowSkipped={(jobId) => setSkippedModalJobId(jobId)}
          onShowIndexed={(jobId) => setIndexedModalJobId(jobId)}
          onShowPipeline={(jobId) => setPipelineModalJobId(jobId)}
        />
        <JobAnalysisModal
          repoId={repoId ?? null}
          projectId={projectId}
          jobId={analysisJobId}
          open={analysisModalOpen}
          onOpenChange={setAnalysisModalOpen}
        />
        <SkippedFilesModal
          open={skippedModalJobId !== null}
          onOpenChange={(open) => !open && setSkippedModalJobId(null)}
          payload={jobs.find((j) => j.id === skippedModalJobId)?.payload}
        />
        <IndexedFilesModal
          open={indexedModalJobId !== null}
          onOpenChange={(open) => !open && setIndexedModalJobId(null)}
          payload={jobs.find((j) => j.id === indexedModalJobId)?.payload}
        />
        <SyncPipelineModal
          open={pipelineModalJobId !== null}
          onOpenChange={(open) => !open && setPipelineModalJobId(null)}
          job={jobs.find((j) => j.id === pipelineModalJobId) ?? null}
        />
      </div>
    </section>
  );
}

interface JobsTableProps {
  jobs: SyncJob[];
  selectedJobIds: Set<string>;
  allSelected: boolean;
  deletingJobs: boolean;
  toggleJobSelection: (jobId: string) => void;
  toggleAllJobs: () => void;
  onDeleteJob: (jobId: string) => void;
  onAnalyzeJob: (jobId: string) => void;
  onShowSkipped: (jobId: string) => void;
  onShowIndexed: (jobId: string) => void;
  onShowPipeline: (jobId: string) => void;
}

/** Jobs table with checkbox column, or dashed empty state. */
function JobsTable({
  jobs,
  selectedJobIds,
  allSelected,
  deletingJobs,
  toggleJobSelection,
  toggleAllJobs,
  onDeleteJob,
  onAnalyzeJob,
  onShowSkipped,
  onShowIndexed,
  onShowPipeline,
}: JobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)]',
          'bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-6 py-14 text-center',
        )}
      >
        <div
          className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]"
          aria-hidden
        >
          <History className="size-6" strokeWidth={1.75} />
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">No hay jobs aún</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--foreground-muted)]">
          Cuando encoles un sync o una re-sincronización, el historial aparecerá aquí con estado, resultado y enlaces a
          detalle.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <Table>
        <TableHeader>
          <TableRow className="border-[var(--border)] hover:bg-transparent">
            <TableHead className="w-10 px-3 py-3 text-[var(--foreground-muted)]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAllJobs}
                className="rounded border-[var(--border)]"
                aria-label="Seleccionar todos los jobs"
              />
            </TableHead>
            <TableHead className="px-3 py-3 text-[var(--foreground-muted)]">Tipo</TableHead>
            <TableHead className="px-3 py-3 text-[var(--foreground-muted)]">Estado</TableHead>
            <TableHead className="px-3 py-3 text-[var(--foreground-muted)]">Inicio</TableHead>
            <TableHead className="px-3 py-3 text-[var(--foreground-muted)]">Fin</TableHead>
            <TableHead className="px-3 py-3 text-[var(--foreground-muted)]">Resultado</TableHead>
            <TableHead className="min-w-[200px] px-3 py-3 text-[var(--foreground-muted)]">Error</TableHead>
            <TableHead className="w-24 px-3 py-3 text-[var(--foreground-muted)]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => (
            <JobRow
              key={j.id}
              job={j}
              isSelected={selectedJobIds.has(j.id)}
              deletingJobs={deletingJobs}
              onToggleSelect={() => toggleJobSelection(j.id)}
              onDelete={() => onDeleteJob(j.id)}
              onAnalyze={() => onAnalyzeJob(j.id)}
              onShowSkipped={() => onShowSkipped(j.id)}
              onShowIndexed={() => onShowIndexed(j.id)}
              onShowPipeline={() => onShowPipeline(j.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface JobRowProps {
  job: SyncJob;
  isSelected: boolean;
  deletingJobs: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onAnalyze: () => void;
  onShowSkipped: () => void;
  onShowIndexed: () => void;
  onShowPipeline: () => void;
}

/** Single job row: selection, status, payload summary, links, actions. */
function JobRow({
  job,
  isSelected,
  deletingJobs,
  onToggleSelect,
  onDelete,
  onAnalyze,
  onShowSkipped,
  onShowIndexed,
  onShowPipeline,
}: JobRowProps) {
  const skipped = (job.payload?.skipped as number) ?? 0;
  const indexed = (job.payload?.indexed as number) ?? 0;
  const hasSkipped = skipped > 0 && job.status === 'completed';
  const hasIndexed = indexed > 0 && job.status === 'completed';

  return (
    <TableRow className="border-[var(--border)]">
      <TableCell className="px-3 py-3 align-middle">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="rounded border-[var(--border)]"
          aria-label={`Seleccionar job ${job.id}`}
        />
      </TableCell>
      <TableCell className="px-3 py-3 align-middle font-mono text-xs text-[var(--foreground)]">{job.type}</TableCell>
      <TableCell className="px-3 py-3 align-middle">
        <StatusBadge status={job.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap px-3 py-3 align-middle font-mono text-xs text-[var(--foreground-muted)]">
        {new Date(job.startedAt).toLocaleString()}
      </TableCell>
      <TableCell className="whitespace-nowrap px-3 py-3 align-middle font-mono text-xs text-[var(--foreground-muted)]">
        {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : '—'}
      </TableCell>
      <TableCell className="max-w-xs px-3 py-3 align-top">
        <div className="flex flex-col items-start gap-1">
          <span className="text-sm text-[var(--foreground)]">{formatJobPayload(job.payload, job.status)}</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {hasIndexed ? (
              <Button
                variant="link"
                size="sm"
                type="button"
                className="h-auto p-0 text-xs text-[var(--primary)] underline underline-offset-4"
                onClick={onShowIndexed}
              >
                Ver indexados
              </Button>
            ) : null}
            {job.type === 'full' ? (
              <Button
                variant="link"
                size="sm"
                type="button"
                className="h-auto p-0 text-xs text-[var(--primary)] underline underline-offset-4"
                title="Ver fases del pipeline (cola, parseo, Falkor, embeddings)"
                onClick={onShowPipeline}
              >
                Pasos del sync
              </Button>
            ) : null}
            {hasSkipped ? (
              <Button
                variant="link"
                size="sm"
                type="button"
                className="h-auto p-0 text-xs text-[var(--primary)] underline underline-offset-4"
                onClick={onShowSkipped}
              >
                Ver omitidos
              </Button>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="min-w-[200px] max-w-xl px-3 py-3 align-top">
        <JobErrorMessage errorMessage={job.errorMessage} />
      </TableCell>
      <TableCell className="px-3 py-3 align-middle">
        <div className="flex flex-wrap justify-end gap-1.5">
          {job.type === 'incremental' && job.status === 'completed' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg border-[var(--border)]"
              onClick={onAnalyze}
            >
              Analizar
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg text-[var(--destructive)] hover:text-[var(--destructive)]"
            onClick={onDelete}
            disabled={deletingJobs}
          >
            Borrar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Renders job error message in a scrollable pre, or em dash when empty. */
function JobErrorMessage({ errorMessage }: { errorMessage?: string | null }) {
  if (!errorMessage) return <span className="text-sm text-[var(--foreground-muted)]">—</span>;
  return (
    <pre className="max-h-32 overflow-auto rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_30%,var(--card))] p-2 text-xs leading-relaxed text-[var(--destructive)] whitespace-pre-wrap break-words">
      {errorMessage}
    </pre>
  );
}
