import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Progressive disclosure block for admin settings (native details, no extra deps). */
export function SettingsDetailsSection(props: {
  id: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={props.id}
      className={cn(
        'group rounded-xl border border-[var(--border)]',
        'bg-[color-mix(in_oklch,var(--muted)_8%,var(--card))]',
      )}
      open={props.defaultOpen}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5',
          '[&::-webkit-details-marker]:hidden',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]',
        )}
      >
        <span>
          <span className="text-sm font-medium text-[var(--foreground)]">{props.title}</span>
          {props.hint ? (
            <span className="mt-0.5 block text-xs text-[var(--foreground-muted)]">{props.hint}</span>
          ) : null}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-[var(--foreground-muted)] transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-4 border-t border-[var(--border)] px-4 py-4 sm:px-5">{props.children}</div>
    </details>
  );
}
