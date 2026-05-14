/**
 * Theme control: compact icon (light ↔ dark) or segmented pill (light / system / dark).
 */
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ARIADNE_THEME_STORAGE_KEY,
  applyTheme,
  getEffectiveTheme,
  getThemePreference,
  type ThemePreference,
} from '@/lib/theme';

type ThemeToggleProps = {
  className?: string;
  /** `outline` marks the edge on headers; `ghost` is subtler. */
  variant?: 'ghost' | 'outline';
  /** `icon` toggles light/dark; `pill` adds system (prefers-color-scheme). */
  layout?: 'icon' | 'pill';
};

export function ThemeToggle({
  className,
  variant = 'ghost',
  layout = 'icon',
}: ThemeToggleProps) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    getThemePreference(),
  );
  const [effectiveIcon, setEffectiveIcon] = useState(() => getEffectiveTheme());

  useEffect(() => {
    if (layout !== 'pill') return;
    applyTheme(preference);
  }, [layout, preference]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== ARIADNE_THEME_STORAGE_KEY) return;
      setEffectiveIcon(getEffectiveTheme());
      if (
        event.newValue === 'light' ||
        event.newValue === 'dark' ||
        event.newValue === 'system'
      ) {
        setPreference(event.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (layout !== 'pill' || preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange() {
      applyTheme('system');
    }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [layout, preference]);

  function handleIconClick() {
    const next: ThemePreference = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setEffectiveIcon(getEffectiveTheme());
    setPreference(next);
  }

  function handlePillSelect(next: ThemePreference) {
    setPreference(next);
  }

  if (layout === 'pill') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card)]/80 p-0.5 shadow-sm backdrop-blur-sm',
          className,
        )}
        role="group"
        aria-label="Tema de la interfaz"
      >
        {(
          [
            { key: 'light' as const, Icon: Sun, label: 'Tema claro' },
            { key: 'system' as const, Icon: Monitor, label: 'Tema del sistema' },
            { key: 'dark' as const, Icon: Moon, label: 'Tema oscuro' },
          ] as const
        ).map(({ key, Icon, label }) => {
          const active = preference === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handlePillSelect(key)}
              className={cn(
                'flex size-9 items-center justify-center rounded-full transition-colors',
                active
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--foreground-muted)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
              )}
              aria-label={label}
              aria-pressed={active}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      className={className}
      onClick={handleIconClick}
      aria-label={
        effectiveIcon === 'dark'
          ? 'Cambiar a tema claro'
          : 'Cambiar a tema oscuro'
      }
      aria-pressed={effectiveIcon === 'light'}
    >
      {effectiveIcon === 'dark' ? (
        <Sun className="size-5 shrink-0 text-[var(--foreground-muted)]" />
      ) : (
        <Moon className="size-5 shrink-0 text-[var(--foreground-muted)]" />
      )}
    </Button>
  );
}
