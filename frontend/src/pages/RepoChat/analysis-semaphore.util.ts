export type AnalysisSemaphoreLevel = 'critical' | 'warning' | 'ok' | 'neutral';

export type AnalysisSemaphoreSummary = {
  critical: number;
  warning: number;
  ok: number;
  neutral: number;
  overall: AnalysisSemaphoreLevel;
};

const CRITICAL_RE =
  /🔴|\bcrític|\bcritic|\balta severidad|\bvulnerab|\bsecreto|\bhigh risk|\bp0\b|\bp1\b|\bbloqueante|\bgrave|\bcritical|\btoken expuesto|\bpassword|\bapi[_-]?key/i;
const WARNING_RE =
  /🟡|⚠|\bwarning|\bantipatr|\bduplicad|\bdeuda|\bsmell|\bmedio|\bp2\b|\brevisar|\bmoderad|\bmejora|\bcomplej|\bacopl|\blegacy|\bmuerto|\bsin uso|\bdead code/i;
const OK_RE =
  /🟢|✅|\bbajo riesgo|\bsin hallazgo|\bno se detect|\bsaludable|\bningún problema|\bbuena práctica|\bok\b/i;
const PATH_LIKE_RE = /\/[\w.-]+\.(tsx?|jsx?|vue|py|go|rs|md)\b|[a-z0-9_-]+\/[a-z0-9_./-]+/i;

function defaultLevelForMode(mode: string | undefined): AnalysisSemaphoreLevel {
  switch (mode) {
    case 'seguridad':
      return 'warning';
    case 'duplicados':
    case 'codigo_muerto':
    case 'diagnostico':
    case 'reingenieria':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Clasifica una línea o fila del informe. */
export function classifyAnalysisLine(line: string, mode?: string): AnalysisSemaphoreLevel {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || /^[-|:\s]+$/.test(trimmed)) return 'neutral';

  if (CRITICAL_RE.test(trimmed)) return 'critical';
  if (WARNING_RE.test(trimmed)) return 'warning';
  if (OK_RE.test(trimmed)) return 'ok';

  const fallback = defaultLevelForMode(mode);
  if (fallback !== 'neutral') {
    if (PATH_LIKE_RE.test(trimmed) || trimmed.includes('`')) return fallback;
    if (mode === 'duplicados' && (trimmed.includes('::') || trimmed.includes('|'))) return 'warning';
  }

  return 'neutral';
}

/** Heurística sobre el markdown del informe para semáforos rápidos. */
export function summarizeAnalysisMarkdown(markdown: string, mode?: string): AnalysisSemaphoreSummary {
  const lines = markdown.split('\n').filter((l) => l.trim().length > 0);
  let critical = 0;
  let warning = 0;
  let ok = 0;
  let neutral = 0;

  for (const line of lines) {
    const level = classifyAnalysisLine(line, mode);
    if (level === 'critical') critical += 1;
    else if (level === 'warning') warning += 1;
    else if (level === 'ok') ok += 1;
    else neutral += 1;
  }

  let overall: AnalysisSemaphoreLevel = 'neutral';
  if (critical > 0) overall = 'critical';
  else if (warning > 0) overall = 'warning';
  else if (ok > 0) overall = 'ok';

  return { critical, warning, ok, neutral, overall };
}

export const SEMAPHORE_LABELS: Record<
  AnalysisSemaphoreLevel,
  { label: string; dotClass: string; badgeClass: string }
> = {
  critical: {
    label: 'Atención alta',
    dotClass: 'bg-red-500',
    badgeClass: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
  },
  warning: {
    label: 'Revisar',
    dotClass: 'bg-amber-500',
    badgeClass: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400',
  },
  ok: {
    label: 'Sin alertas graves',
    dotClass: 'bg-emerald-500',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400',
  },
  neutral: {
    label: 'Informe listo',
    dotClass: 'bg-[var(--foreground-muted)]',
    badgeClass: 'border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_8%,var(--card))] text-[var(--foreground-muted)]',
  },
};
