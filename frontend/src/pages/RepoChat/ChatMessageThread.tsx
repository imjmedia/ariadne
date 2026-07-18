import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatPipelineMode } from '@/types';
import { ChatPromptChips } from '@/components/ChatPromptChips';
import type { ChatPromptTemplate } from '@/utils/chat-prompt-templates';
import { cn } from '@/lib/utils';
import { ChatAssistantContent } from './ChatAssistantContent';
import {
  chatBubbleAssistantClass,
  chatBubbleUserClass,
  chatEmptyStateClass,
} from '../chat/chatShellClasses';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  cypher?: string;
}

const userMarkdownProseClass = cn(
  '[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_p]:my-1 [&_strong]:font-semibold [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_pre]:overflow-x-auto [&_table]:w-full [&_th]:border [&_th]:border-[var(--border)] [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-2 [&_td]:py-1',
);

export function ChatMessageThread(props: {
  messages: ChatMessage[];
  loading: boolean;
  chatPipelineMode: ChatPipelineMode;
  onPromptSelect: (template: ChatPromptTemplate) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  emptyTitle?: string;
  emptyDescription?: string;
  composerPlaceholder?: string;
}) {
  const emptyTitle = props.emptyTitle ?? '¿Qué quieres saber del código?';
  const emptyDescription =
    props.emptyDescription ??
    'Pregunta por componentes, flujos, APIs o impacto de un cambio. Ariadne consulta el grafo indexado.';
  return (
    <div className="mx-auto min-h-0 w-full max-w-[44rem] flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-1 py-1 sm:px-2">
      {props.messages.length === 0 ? (
        <div className={chatEmptyStateClass}>
          <p className="text-base font-medium text-[var(--foreground)]">{emptyTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
            {emptyDescription}
          </p>
          <ChatPromptChips
            disabled={props.loading}
            className="mx-auto mt-5 max-w-lg justify-center"
            onSelect={props.onPromptSelect}
          />
        </div>
      ) : null}

      {props.messages.map((m, i) => (
        <div key={i} className={cn('flex flex-col gap-1', m.role === 'user' ? 'items-end' : 'items-start')}>
          <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
            {m.role === 'user' ? 'Tú' : 'Ariadne'}
          </span>
          <div className={m.role === 'user' ? chatBubbleUserClass : chatBubbleAssistantClass}>
            {m.role === 'assistant' ? (
              <ChatAssistantContent content={m.content} />
            ) : (
              <div className={userMarkdownProseClass}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (children ? <p className="mb-1 last:mb-0">{children}</p> : null),
                    ul: ({ children }) => <ul className="my-1 list-disc pl-4">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1 list-decimal pl-4">{children}</ol>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    table: ({ children }) => (
                      <div className="my-2 overflow-x-auto">
                        <table className="w-full border-collapse text-xs">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-2 py-1 text-left font-medium">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-[var(--border)] px-2 py-1">{children}</td>
                    ),
                    code: ({ className, children, ...rest }) => {
                      const isBlock = className?.includes('language-');
                      return isBlock ? (
                        <pre className="my-2 overflow-x-auto rounded-lg bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] p-2 font-mono text-xs">
                          <code {...rest}>{children}</code>
                        </pre>
                      ) : (
                        <code
                          className="rounded-md bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-1 py-0.5 font-mono text-xs"
                          {...rest}
                        >
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            )}
            {m.cypher ? (
              <details className="mt-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))]">
                <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-[var(--foreground-muted)]">
                  Ver consulta Cypher
                </summary>
                <pre className="overflow-x-auto border-t border-[var(--border)] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--foreground)]">
                  {m.cypher}
                </pre>
              </details>
            ) : null}
          </div>
        </div>
      ))}

      {props.loading ? (
        <div className="flex flex-col items-start gap-1">
          <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
            Ariadne
          </span>
          <div className={cn(chatBubbleAssistantClass, 'flex items-center gap-2 text-[var(--foreground-muted)]')}>
            <span
              className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
            {props.chatPipelineMode === 'evidence_first'
              ? 'Generando MDD…'
              : props.chatPipelineMode === 'raw_evidence_fast'
                ? 'Recolectando evidencia…'
                : 'Pensando…'}
          </div>
        </div>
      ) : null}

      <div ref={props.scrollRef} className="h-px shrink-0" aria-hidden />
    </div>
  );
}
