/**
 * Renderer legacy (react-markdown + remark-gfm). Se mantiene para chat/análisis hasta validar TanStack.
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from '@/components/MermaidDiagram';
import { cn } from '@/lib/utils';
import { extractCodeBlockText, isMermaidLang } from './markdown-code.util';

export type LegacyMarkdownComponents = NonNullable<ComponentPropsWithoutRef<typeof ReactMarkdown>['components']>;

export function legacyCodeComponent(props: {
  className?: string;
  children?: ReactNode;
}): ReactNode {
  const lang = props.className?.replace('language-', '') ?? '';
  const text = String(props.children ?? '').replace(/\n$/, '');
  if (isMermaidLang(lang)) {
    return <MermaidDiagram chart={text} />;
  }
  const isBlock = Boolean(props.className);
  return isBlock ? (
    <pre className="my-2 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
      <code>{props.children}</code>
    </pre>
  ) : (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{props.children}</code>
  );
}

export function legacyTableComponents(): Pick<
  LegacyMarkdownComponents,
  'table' | 'th' | 'td'
> {
  return {
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border bg-muted/80 px-2 py-1 text-left font-medium">{children}</th>
    ),
    td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
  };
}

export function LegacyMarkdown(props: {
  content: string;
  className?: string;
  components?: LegacyMarkdownComponents;
}) {
  const raw = typeof props.content === 'string' ? props.content : String(props.content ?? '');
  return (
    <div className={cn(props.className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={props.components}>
        {raw}
      </ReactMarkdown>
    </div>
  );
}

export function legacyPreFromTanStack(props: ComponentPropsWithoutRef<'pre'> & { 'data-lang'?: string }) {
  if (isMermaidLang(props['data-lang'])) {
    return <MermaidDiagram chart={extractCodeBlockText(props.children).trim()} />;
  }
  return <pre {...props} />;
}
