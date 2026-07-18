/**
 * Shared layout / surface classes for repo and project chat pages.
 */
import { cn } from '@/lib/utils';
import { panelIntroClass, sectionHeaderClass, sectionShellClass } from '../RepoDetail/layoutClasses';

export { panelIntroClass, sectionHeaderClass, sectionShellClass };

/** Outer page width + vertical rhythm (matches RepoIndex / RepoDetail). */
export const chatPageMaxClass =
  'mx-auto flex w-full max-w-[min(1400px,calc(100vw-2rem))] flex-col gap-3 sm:gap-4';

/** Repo/project chat: historial a la izquierda + conversación a la derecha. */
export const chatPageSplitClass =
  'mx-auto flex w-full max-w-[min(1600px,calc(100vw-2rem))] min-h-0 flex-1 flex-row items-stretch gap-3 pb-4 sm:gap-4 xl:h-[min(calc(100dvh-9.25rem),900px)] xl:pb-0';

/** Primary nav pills (back, detail, …). */
export const chatNavBtnClass =
  'h-10 gap-2 rounded-xl border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)] touch-manipulation';

/** Analysis action grid buttons. */
export const chatAnalysisBtnClass = cn(
  'h-11 w-full rounded-xl border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--foreground)]',
  'touch-manipulation transition-colors hover:bg-[color-mix(in_oklch,var(--muted)_32%,var(--card))]',
  'disabled:pointer-events-none disabled:opacity-50',
);

export const chatMarkdownBoxClass =
  'min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_18%,var(--card))] p-3 text-sm text-[var(--foreground)] [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_p]:my-1 [&_strong]:font-semibold [&_pre]:overflow-x-auto [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_table]:w-full [&_th]:border [&_th]:border-[var(--border)] [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-2 [&_td]:py-1';

export const chatBubbleUserClass = cn(
  'max-w-[min(100%,34rem)] rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] px-4 py-3 text-sm text-[var(--foreground)] shadow-sm',
);

export const chatBubbleAssistantClass = cn(
  'max-w-full rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-4 py-3 text-sm text-[var(--foreground)] shadow-sm',
);

export const chatEmptyStateClass = cn(
  'rounded-2xl border border-dashed border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_10%,var(--card))] px-5 py-10 text-center',
);

export const chatMobileTablistClass = cn(
  'grid shrink-0 grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_16%,var(--card))] p-1 xl:hidden',
);

export function chatMobileTabClass(active: boolean): string {
  return cn(
    'rounded-xl px-3 py-2.5 text-center text-sm font-medium transition-colors touch-manipulation',
    active
      ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]/80'
      : 'text-[var(--foreground-muted)] hover:bg-[var(--card)]/80 hover:text-[var(--foreground)]',
  );
}
