/**
 * Top bar: compact search left; theme, notifications (placeholder), profile avatar right — reference-style circles.
 */
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { HeaderSearch } from '@/components/HeaderSearch';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar } from '@/components/atoms/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { UserInfo } from '@/utils/auth';

const headerIconButtonClass =
  'flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] shadow-none transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]';

export type AppShellHeaderProps = {
  user: UserInfo | null;
};

export function AppShellHeader({ user }: AppShellHeaderProps) {
  const displayName = user?.name?.trim() || user?.email || 'Usuario';

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 items-center justify-between gap-2 sm:gap-3">
      <HeaderSearch />
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <ThemeToggle variant="ghost" layout="icon" className={headerIconButtonClass} />
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end">
            Cambiar tema
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(headerIconButtonClass, 'touch-manipulation')}
              aria-label="Notificaciones"
            >
              <Bell className="size-[1.15rem] shrink-0" strokeWidth={1.75} aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end">
            Notificaciones (próximamente)
          </TooltipContent>
        </Tooltip>
        {user ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/profile"
                className={cn(
                  headerIconButtonClass,
                  'overflow-hidden p-0 hover:opacity-95',
                  'border-[var(--border)] bg-[var(--secondary)]',
                )}
                aria-label={`Perfil: ${displayName}`}
              >
                <Avatar name={displayName} size="sm" className="!size-9 border-0 ring-0" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="max-w-[min(18rem,calc(100vw-2rem))] break-words">
              {displayName}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
