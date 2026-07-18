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
