/**
 * Evita zoom del navegador (Ctrl+rueda / pinch de página) fuera de superficies Mermaid.
 */
let installed = false;

export function installPreventGlobalGestureZoom(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const target = e.target;
      if (target instanceof Element && target.closest('[data-mermaid-zoom]')) return;
      e.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener(
    'gesturestart',
    (e) => {
      const target = e.target;
      if (target instanceof Element && target.closest('[data-mermaid-zoom]')) return;
      e.preventDefault();
    },
    { passive: false },
  );
}
