import { cn } from '@/lib/utils';

/** Settings page shell — compact admin form rhythm (see DESIGN.md). */
export const settingsPageClass = 'mx-auto max-w-3xl space-y-5 pb-8';

/** Body padding inside a settings domain section (LLM, The Forge). */
export const settingsSectionBodyClass = 'space-y-5 px-5 py-5 sm:px-6';

/** Internal subsection: h3 + border divider, not nested boxed cards. */
export const settingsSubsectionClass =
  'space-y-4 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0';

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
