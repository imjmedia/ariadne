/**
 * Renderer TanStack Markdown (@tanstack/markdown/react).
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Markdown, type MarkdownComponents } from '@tanstack/markdown/react';
import { MermaidDiagram } from '@/components/MermaidDiagram';
import { cn } from '@/lib/utils';
import { extractCodeBlockText, isMermaidLang } from './markdown-code.util';

function TanStackPre(props: ComponentPropsWithoutRef<'pre'> & { 'data-lang'?: string }) {
  if (isMermaidLang(props['data-lang'])) {
    return <MermaidDiagram chart={extractCodeBlockText(props.children).trim()} />;
  }
  return <pre {...props} />;
}

function TanStackCode(props: ComponentPropsWithoutRef<'code'>) {
  const isBlock = props.className?.startsWith('language-');
  if (isBlock) {
    return <code {...props} />;
  }
  return (
    <code
      {...props}
      className={cn(
        'rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_38%,var(--card))] px-1.5 py-0.5 font-mono text-[13px]',
        props.className,
      )}
    />
  );
}

export function buildTanStackComponents(
  extra?: Partial<MarkdownComponents>,
): Partial<MarkdownComponents> {
  return {
    pre: TanStackPre,
    code: TanStackCode,
    ...extra,
  };
}

export function TanStackMarkdown(props: {
  content: string;
  className?: string;
  components?: Partial<MarkdownComponents>;
}) {
  const raw = typeof props.content === 'string' ? props.content : String(props.content ?? '');
  return (
    <div className={props.className}>
      <Markdown components={buildTanStackComponents(props.components)} frontmatter={false}>
        {raw}
      </Markdown>
    </div>
  );
}

export type DocLinkRenderer = (props: { href?: string; children?: ReactNode }) => ReactNode;

export function docLinkComponent(renderLink: DocLinkRenderer): MarkdownComponents['a'] {
  return (props) => renderLink({ href: props.href, children: props.children });
}
