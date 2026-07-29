import { isValidElement, type ReactNode } from 'react';

/** Extrae texto de `<pre><code>…</code></pre>` (TanStack Markdown u otros renderers). */
export function extractCodeBlockText(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractCodeBlockText).join('');
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return extractCodeBlockText(children.props.children);
  }
  return '';
}

export function isMermaidLang(lang: string | undefined | null): boolean {
  return (lang ?? '').trim().toLowerCase() === 'mermaid';
}
