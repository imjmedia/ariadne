import { Link } from 'react-router-dom';
import type { AnalyzeCodeMode, AnalyzeReportMeta, FullAuditResult } from '@/types';
import { MarkdownBlock } from '@/components/MarkdownBlock';
import { AnalyzeReportMetaBadges } from '@/components/analyze/AnalyzeReportMetaBadges';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { chatAnalysisBtnClass, chatMarkdownBoxClass, sectionHeaderClass, sectionShellClass } from '../chat/chatShellClasses';
import {
  ANALYSIS_MODE_LABELS,
  ANALYSIS_RESULT_TITLES,
  PRIMARY_ANALYSIS_ACTIONS,
  SECONDARY_ANALYSIS_ACTIONS,
} from './chatConstants';
import { FullAuditModal } from './FullAuditModal';

type ProjectRepo = { id: string; projectKey: string; repoSlug: string };

export function ChatAnalysisSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  loadingAnalysis: string | null;
  analysisError: string | null;
  analysisResult: { mode: string; summary: string; reportMeta?: AnalyzeReportMeta } | null;
  onRunAnalysis: (mode: AnalyzeCodeMode) => void;
  codeAnalysisDisabled?: boolean;
  projectRepos?: ProjectRepo[];
  selectedRepoId?: string;
  onSelectedRepoIdChange?: (repoId: string) => void;
  indexHref?: string | null;
  showFullAudit?: boolean;
  onRunFullAudit?: () => void;
  fullAuditOpen?: boolean;
  onFullAuditOpenChange?: (open: boolean) => void;
  fullAuditData?: FullAuditResult | null;
  fullAuditLoading?: boolean;
  fullAuditError?: string | null;
}) {
  const title = props.title ?? 'Análisis del repositorio';
  const description =
    props.description ??
    'Informes sobre el código indexado. El chat sigue disponible al cerrar este panel.';
  const showFullAudit = props.showFullAudit !== false;
  const codeDisabled = props.codeAnalysisDisabled || !!props.loadingAnalysis;
  const multiRepo = (props.projectRepos?.length ?? 0) > 1;

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            'fixed inset-y-0 right-0 left-auto top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-y-0 border-r-0 p-0 sm:max-w-md sm:rounded-l-2xl sm:border-l',
          )}
        >
          <DialogHeader className="shrink-0 border-b border-[var(--border)] px-5 py-4 text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 space-y-4 border-b border-[var(--border)] px-5 py-4">
              {multiRepo && props.onSelectedRepoIdChange ? (
                <div className="space-y-2">
                  <Label htmlFor="analysis-repo" className="text-xs font-medium text-[var(--foreground-muted)]">
                    Repositorio para análisis de código
                  </Label>
                  <Select value={props.selectedRepoId} onValueChange={props.onSelectedRepoIdChange}>
                    <SelectTrigger id="analysis-repo" size="sm" className="h-10 w-full rounded-xl font-mono text-xs">
                      <SelectValue placeholder="Elegir repositorio" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.projectRepos?.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="font-mono text-xs">
                          {r.projectKey}/{r.repoSlug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
                  Frecuentes
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {PRIMARY_ANALYSIS_ACTIONS.map((action) => (
                    <Button
                      key={action.mode}
                      type="button"
                      variant="outline"
                      className={cn(chatAnalysisBtnClass, 'h-auto flex-col items-start gap-0.5 py-3 text-left')}
                      onClick={() => props.onRunAnalysis(action.mode)}
                      disabled={codeDisabled}
                    >
                      <span className="text-sm font-medium">
                        {props.loadingAnalysis === action.mode ? 'Analizando…' : action.label}
                      </span>
                      <span className="text-[11px] font-normal text-[var(--foreground-muted)]">
                        {action.description}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              <details className="group rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_6%,var(--card))]">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
                  Más análisis
                </summary>
                <div className="space-y-2 border-t border-[var(--border)] px-3 pb-3 pt-2">
                  {SECONDARY_ANALYSIS_ACTIONS.map((action) => (
                    <Button
                      key={action.mode}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start rounded-lg px-2 py-2 text-left"
                      onClick={() => props.onRunAnalysis(action.mode)}
                      disabled={!!props.loadingAnalysis || (action.mode !== 'agents' && action.mode !== 'skill' && props.codeAnalysisDisabled)}
                      title={action.title}
                    >
                      <span className="block text-sm font-medium">{action.label}</span>
                      <span className="block text-[11px] font-normal text-[var(--foreground-muted)]">
                        {action.description}
                      </span>
                    </Button>
                  ))}
                  {showFullAudit && props.onRunFullAudit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start rounded-lg px-2 py-2 text-left"
                      onClick={props.onRunFullAudit}
                      disabled={!!props.loadingAnalysis}
                    >
                      <span className="block text-sm font-medium">Full Audit</span>
                      <span className="block text-[11px] font-normal text-[var(--foreground-muted)]">
                        Arquitectura, seguridad y plan de acción
                      </span>
                    </Button>
                  ) : null}
                  {props.indexHref ? (
                    <Button type="button" variant="ghost" className="h-9 w-full justify-start px-2" asChild>
                      <Link to={props.indexHref}>Explorar índice del grafo</Link>
                    </Button>
                  ) : null}
                </div>
              </details>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {props.loadingAnalysis ? (
                <section className={sectionShellClass}>
                  <div className={sectionHeaderClass}>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {ANALYSIS_MODE_LABELS[props.loadingAnalysis] ?? props.loadingAnalysis}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 px-5 py-8 text-sm text-[var(--foreground-muted)]">
                    <span
                      className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                    Analizando…
                  </div>
                </section>
              ) : null}

              {props.analysisError && !props.loadingAnalysis ? (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertTitle>Error en el análisis</AlertTitle>
                  <AlertDescription>{props.analysisError}</AlertDescription>
                </Alert>
              ) : null}

              {props.analysisResult && !props.loadingAnalysis ? (
                <section className={cn(sectionShellClass, 'flex min-h-0 flex-col')}>
                  <div className={sectionHeaderClass}>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {ANALYSIS_RESULT_TITLES[props.analysisResult.mode] ?? props.analysisResult.mode}
                    </h3>
                    <AnalyzeReportMetaBadges meta={props.analysisResult.reportMeta} />
                    {props.analysisResult.reportMeta?.graphCoverageNote ? (
                      <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-muted)]">
                        {props.analysisResult.reportMeta.graphCoverageNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex min-h-0 flex-col p-4">
                    <div className={chatMarkdownBoxClass}>
                      <MarkdownBlock
                        content={
                          typeof props.analysisResult.summary === 'string'
                            ? props.analysisResult.summary
                            : String(props.analysisResult.summary ?? '')
                        }
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              {!props.analysisResult && !props.loadingAnalysis && !props.analysisError ? (
                <p className="py-8 text-center text-xs leading-relaxed text-[var(--foreground-muted)]">
                  Elige un análisis arriba. Los informes se guardan aquí hasta que ejecutes otro.
                </p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showFullAudit && props.onFullAuditOpenChange ? (
        <FullAuditModal
          open={props.fullAuditOpen ?? false}
          onOpenChange={props.onFullAuditOpenChange}
          data={props.fullAuditData ?? null}
          loading={props.fullAuditLoading ?? false}
          error={props.fullAuditError ?? null}
        />
      ) : null}
    </>
  );
}
