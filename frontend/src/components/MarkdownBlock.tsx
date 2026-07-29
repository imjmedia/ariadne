/**
 * @fileoverview Renderiza markdown con soporte GFM y Mermaid vía {@link AriadneMarkdown}.
 */
import { AriadneMarkdown } from '@/components/ariadne-markdown';
import { legacyCodeComponent, legacyTableComponents } from '@/components/ariadne-markdown/LegacyMarkdown';

interface MarkdownBlockProps {
  content: string;
  className?: string;
}

/** @deprecated Preferir `AriadneMarkdown` directamente. Mantiene API legacy. */
export function MarkdownBlock({ content, className = '' }: MarkdownBlockProps) {
  return (
    <AriadneMarkdown
      content={content}
      className={className}
      variant="chat"
      engine="legacy"
      legacyComponents={{
        code: legacyCodeComponent,
        ...legacyTableComponents(),
        h1: ({ children }) => <h1 className="mb-1 mt-2 text-lg font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-1 mt-4 text-base font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-medium">{children}</h3>,
      }}
    />
  );
}
