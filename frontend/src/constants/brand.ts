/**
 * Brand asset URLs (`public/brand/`).
 * Wordmarks use PNG so `<img>` always renders (SVG-in-img often blocks nested raster refs).
 * Replace PNG paths with `.svg` only when you ship self-contained vector files.
 */

function withPublicBase(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (base === '/') return normalized;
  return `${base.replace(/\/$/, '')}${normalized}`;
}

/** Full horizontal wordmark for light UI (sidebar, login, etc.). */
export const BRAND_WORDMARK_LIGHT_SRC = withPublicBase('/brand/wordmark-light.png');
/** Full horizontal wordmark for dark UI. */
export const BRAND_WORDMARK_DARK_SRC = withPublicBase('/brand/wordmark-dark.png');

export const BRAND_LOGO_LIGHT_SRC = BRAND_WORDMARK_LIGHT_SRC;
export const BRAND_LOGO_DARK_SRC = BRAND_WORDMARK_DARK_SRC;

/** Square mark only (sidebar collapsed). */
export const BRAND_MARK_LIGHT_SRC = withPublicBase('/brand/logo-light.png');
export const BRAND_MARK_DARK_SRC = withPublicBase('/brand/logo-dark.png');

/** Tab / window icon; use distinct light/dark assets when available. */
export const BRAND_FAVICON_DARK_SRC = withPublicBase('/brand/favicon.png');
export const BRAND_FAVICON_LIGHT_SRC = withPublicBase('/brand/favicon.png');

export function getBrandedFaviconHref(effective: 'light' | 'dark'): string {
  return effective === 'dark' ? BRAND_FAVICON_DARK_SRC : BRAND_FAVICON_LIGHT_SRC;
}
