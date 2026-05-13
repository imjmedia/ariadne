/**
 * @fileoverview Theme persistence (light/dark) on `document.documentElement` via `.light` class.
 * @see `src/styles/vars.css` for token definitions.
 */

export const ARIADNE_THEME_STORAGE_KEY = 'ariadne-theme';

export type ThemeMode = 'light' | 'dark';

export function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(ARIADNE_THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    /* ignore */
  }
  return null;
}

/** Resolved theme when the app loads: stored value or default dark (legacy single-mode default). */
export function getResolvedTheme(): ThemeMode {
  return readStoredTheme() ?? 'dark';
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }
  root.style.colorScheme = mode === 'light' ? 'light' : 'dark';

  try {
    localStorage.setItem(ARIADNE_THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }

  const themeColor = mode === 'light' ? '#f8fafc' : '#020617';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute('content', mode === 'light' ? 'light dark' : 'dark light');
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getResolvedTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
