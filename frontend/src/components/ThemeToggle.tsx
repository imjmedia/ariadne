/**
 * Switches between light and dark theme using `.light` on `html` and localStorage.
 */
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ARIADNE_THEME_STORAGE_KEY,
  applyTheme,
  getResolvedTheme,
  type ThemeMode,
} from '@/lib/theme';

type ThemeToggleProps = {
  className?: string;
  /** `outline` marca mejor el borde sobre la cabecera; `ghost` es más discreto (p. ej. login). */
  variant?: 'ghost' | 'outline';
};

export function ThemeToggle({
  className,
  variant = 'ghost',
}: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>(() => getResolvedTheme());

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== ARIADNE_THEME_STORAGE_KEY || !event.newValue) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        applyTheme(event.newValue);
        setMode(event.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function handleClick() {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setMode(next);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      className={className}
      onClick={handleClick}
      aria-label={mode === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-pressed={mode === 'light'}
    >
      {mode === 'dark' ? (
        <Sun className="size-5 shrink-0 text-[var(--foreground-muted)]" />
      ) : (
        <Moon className="size-5 shrink-0 text-[var(--foreground-muted)]" />
      )}
    </Button>
  );
}
