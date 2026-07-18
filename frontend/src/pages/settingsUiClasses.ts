import { cn } from '@/lib/utils';

/** Native checkbox styling aligned across Settings cards. */
export const settingsCheckboxClass =
  'mt-0.5 size-4 shrink-0 rounded border border-[var(--border)] accent-[var(--primary)]';

/** Bordered toggle row for opt-in settings (The Forge, chat router, …). */
export const settingsToggleFieldClass = cn(
  'flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3 sm:p-4',
  'transition-colors hover:bg-[color-mix(in_oklch,var(--muted)_14%,var(--card))]',
  'has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--foreground)]/18',
);

/** Nested form block inside a settings section. */
export const settingsFormSubsectionClass = cn(
  'space-y-4 rounded-xl border border-[var(--border)]',
  'bg-[color-mix(in_oklch,var(--muted)_10%,var(--card))] p-4 sm:p-5',
);

export const settingsAlertClass = 'rounded-xl';
