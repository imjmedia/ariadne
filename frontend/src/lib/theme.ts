/**
 * @fileoverview Theme preference (light / dark / system) on `document.documentElement` via `.dark`.
 * Light mode uses cosmic-night `:root` tokens; dark mode uses `.dark` from `src/index.css`.
 */

export const ARIADNE_THEME_STORAGE_KEY = 'ariadne-theme';

export type ThemePreference = 'light' | 'dark' | 'system';

export type EffectiveTheme = 'light' | 'dark';

function getSystemScheme(): EffectiveTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function readStoredTheme(): ThemePreference | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(ARIADNE_THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* ignore */
  }
  return null;
}

/** Stored preference, or default dark (cosmic-night default surface). */
export function getThemePreference(): ThemePreference {
  return readStoredTheme() ?? 'dark';
}

/** Resolved light/dark for UI and `color-scheme` (follows OS when preference is system). */
export function getEffectiveTheme(): EffectiveTheme {
  const pref = getThemePreference();
  if (pref === 'system') return getSystemScheme();
  return pref;
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const effective = preference === 'system' ? getSystemScheme() : preference;

  if (effective === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.remove('light');
  }

  root.style.colorScheme = effective === 'light' ? 'light' : 'dark';

  try {
    localStorage.setItem(ARIADNE_THEME_STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }

  const themeColorMeta = effective === 'light' ? '#f8f7fc' : '#1a1824';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColorMeta);
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute('content', effective === 'light' ? 'light dark' : 'dark light');
}

/** @deprecated Use getThemePreference / getEffectiveTheme */
export function getResolvedTheme(): EffectiveTheme {
  return getEffectiveTheme();
}

export function toggleTheme(): ThemePreference {
  const next: ThemePreference = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
