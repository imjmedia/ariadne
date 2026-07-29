/**
 * @fileoverview Markdown unificado Ariadne: TanStack (spike/docs) o legacy (react-markdown).
 */
import type { ReactNode } from 'react';
import type { MarkdownComponents } from '@tanstack/markdown/react';
import { LegacyMarkdown, type LegacyMarkdownComponents } from './LegacyMarkdown';
import { TanStackMarkdown, type DocLinkRenderer } from './TanStackMarkdown';
import { proseClassForVariant, type AriadneMarkdownVariant } from './markdown-prose';

export type AriadneMarkdownEngine = 'tanstack' | 'legacy';

export type AriadneMarkdownProps = {
  content: string;
  /** `docs` = Ayuda; `chat`/`analysis` siguen en legacy hasta validar corpus LLM */
  variant?: AriadneMarkdownVariant;
  /** Por defecto `legacy`; DocViewer usa `tanstack` en el spike */
  engine?: AriadneMarkdownEngine;
  className?: string;
  /** Solo TanStack */
  tanstackComponents?: Partial<MarkdownComponents>;
  /** Solo legacy */
  legacyComponents?: LegacyMarkdownComponents;
  /** Atajo para enlaces en variant docs (TanStack) */
  renderDocLink?: DocLinkRenderer;
};

export function AriadneMarkdown(props: AriadneMarkdownProps) {
  const variant = props.variant ?? 'chat';
  const engine = props.engine ?? 'legacy';
  const prose = proseClassForVariant(variant);
  const className = [prose, props.className].filter(Boolean).join(' ');

  if (engine === 'tanstack') {
    const components: Partial<MarkdownComponents> = {
      ...props.tanstackComponents,
    };
    if (props.renderDocLink) {
      components.a = (linkProps) =>
        props.renderDocLink!({ href: linkProps.href, children: linkProps.children as ReactNode });
    }
    return (
      <TanStackMarkdown content={props.content} className={className} components={components} />
    );
  }

  return (
    <LegacyMarkdown
      content={props.content}
      className={className}
      components={props.legacyComponents}
    />
  );
}

export type { AriadneMarkdownVariant } from './markdown-prose';
export { ARIADNE_MARKDOWN_FIXTURES } from './fixtures';
