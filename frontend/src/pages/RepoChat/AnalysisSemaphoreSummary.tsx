import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  SEMAPHORE_LABELS,
  summarizeAnalysisMarkdown,
  type AnalysisSemaphoreSummary as Summary,
} from './analysis-semaphore.util';

function CountPill(props: { colorClass: string; label: string; count: number }) {
  if (props.count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium',
      )}
    >
      <span className={cn('size-2 shrink-0 rounded-full', props.colorClass)} aria-hidden />
      {props.label}: {props.count}
    </span>
  );
}

export function AnalysisSemaphoreSummary(props: { summary: string; mode: string }) {
  const signals: Summary = summarizeAnalysisMarkdown(props.summary);
  const meta = SEMAPHORE_LABELS[signals.overall];

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_6%,var(--card))] px-4 py-3"
      role="status"
      aria-label="Resumen visual del informe"
    >
      <Badge variant="outline" className={cn('gap-1.5 rounded-lg px-2.5 py-1', meta.badgeClass)}>
        <span className={cn('size-2 rounded-full', meta.dotClass)} aria-hidden />
        {meta.label}
      </Badge>
      <CountPill colorClass="bg-red-500" label="Crítico" count={signals.critical} />
      <CountPill colorClass="bg-amber-500" label="Advertencias" count={signals.warning} />
      <CountPill colorClass="bg-emerald-500" label="OK" count={signals.ok} />
      <span className="text-[11px] text-[var(--foreground-muted)]">
        Semáforos heurísticos sobre el informe · modo {props.mode}
      </span>
    </div>
  );
}
