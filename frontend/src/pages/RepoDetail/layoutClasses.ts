import { cn } from '@/lib/utils';

/** Page width aligned with project detail and profile. */
export const repoDetailPageClass = 'mx-auto max-w-5xl space-y-6 pb-10';

export const panelIntroClass = cn(
  'rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

export const sectionShellClass = cn(
  'overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

export const sectionHeaderClass = cn(
  'border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_26%,var(--card))]',
  'px-5 py-4 sm:px-6',
);

/** Click-to-copy ID field (repository / project MCP). */
export const monoIdFieldClass = cn(
  'mt-1 block w-full max-w-full cursor-pointer truncate rounded-xl border border-[var(--border)]',
  'bg-[color-mix(in_oklch,var(--muted)_38%,var(--card))] px-3 py-2 text-left font-mono text-xs text-[var(--foreground)]',
  'transition-colors hover:border-[var(--border)] hover:bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]',
);

export const monoIdFieldWarningClass = cn(
  monoIdFieldClass,
  'border-amber-500/45 bg-amber-500/10 hover:border-amber-500/55 hover:bg-amber-500/[0.16] dark:bg-amber-500/15',
);
