import { cn } from '@/lib/utils';

export const settingsPageClass = 'mx-auto max-w-3xl space-y-5 pb-8';

export const settingsSectionBodyClass = 'space-y-5 px-5 py-5 sm:px-6';

/** Native checkbox styling aligned across Settings cards. */
export const settingsCheckboxClass =
  'mt-0.5 size-4 shrink-0 rounded border border-[var(--border)] accent-[var(--primary)]';

/** Bordered toggle row for opt-in settings (The Forge, chat router, …). */
export const settingsToggleFieldClass = cn(
  'flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3 sm:p-4',
  'transition-colors hover:bg-[color-mix(in_oklch,var(--muted)_14%,var(--card))]',
  'has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--foreground)]/18',
);

export const settingsAlertClass = 'rounded-xl';

export const settingsTabListClass = cn(
  'flex w-full flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] p-1',
);

export function settingsTabPillClass(active: boolean): string {
  return cn(
    'min-h-9 flex-1 rounded-xl px-3 py-2 text-center text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
    active
      ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]/80'
      : 'text-[var(--foreground-muted)] hover:bg-[var(--card)]/40 hover:text-[var(--foreground)]',
  );
}
