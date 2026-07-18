import { createContext, useContext, Children, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from '@/components/MermaidDiagram';
import { cn } from '@/lib/utils';
import {
  classifyAnalysisLine,
  SEMAPHORE_LABELS,
  type AnalysisSemaphoreLevel,
} from './analysis-semaphore.util';

const AnalysisModeContext = createContext<string>('diagnostico');
const TableSectionContext = createContext<'thead' | 'tbody'>('tbody');

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement(node)) return extractText(node.props.children);
  return '';
}

export function SemaphoreDot(props: {
  level: AnalysisSemaphoreLevel;
  className?: string;
  title?: string;
}) {
  const meta = SEMAPHORE_LABELS[props.level];
  return (
    <span
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full ring-2 ring-[var(--background)]',
        meta.dotClass,
        props.className,
      )}
      title={props.title ?? meta.label}
      aria-label={meta.label}
      role="img"
    />
  );
}

function AnalysisTableRow({ children }: { children?: ReactNode }) {
  const mode = useContext(AnalysisModeContext);
  const section = useContext(TableSectionContext);

  if (section === 'thead') {
    return (
      <tr>
        <th
          className="w-11 border-b border-[var(--border)] px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-muted)]"
          scope="col"
          aria-label="Estado"
        >
          ●
        </th>
        {children}
      </tr>
    );
  }

  const rowText = extractText(children);
  const level = classifyAnalysisLine(rowText, mode);
  const rowTint =
    level === 'critical'
      ? 'bg-red-500/[0.06]'
      : level === 'warning'
        ? 'bg-amber-500/[0.06]'
        : level === 'ok'
          ? 'bg-emerald-500/[0.05]'
          : undefined;

  return (
    <tr className={cn('border-b border-[var(--border)] last:border-b-0', rowTint)}>
      <td className="w-11 border-[var(--border)] px-2 py-2 text-center align-top">
        <SemaphoreDot level={level} className="mx-auto" />
      </td>
      {children}
    </tr>
  );
}

function AnalysisListItem({ children }: { children?: ReactNode }) {
  const mode = useContext(AnalysisModeContext);
  const text = extractText(children);
  const level = classifyAnalysisLine(text, mode);
  return (
    <li className="flex items-start gap-2.5 py-1">
      <SemaphoreDot level={level} className="mt-1.5" />
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function AnalysisHeading(props: { level: 2 | 3; children?: ReactNode }) {
  const mode = useContext(AnalysisModeContext);
  const text = extractText(props.children);
  const level = classifyAnalysisLine(text, mode);
  const Tag = props.level === 2 ? 'h2' : 'h3';
  const className =
    props.level === 2
      ? 'mb-1 mt-4 flex items-center gap-2 text-base font-semibold'
      : 'mb-1 mt-3 flex items-center gap-2 text-sm font-medium';
  return (
    <Tag className={className}>
      <SemaphoreDot level={level} />
      {props.children}
    </Tag>
  );
}

export function AnalysisMarkdownReport(props: { content: string; mode: string; className?: string }) {
  const raw = typeof props.content === 'string' ? props.content : String(props.content ?? '');

  return (
    <AnalysisModeContext.Provider value={props.mode}>
      <div className={props.className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code: ({ className: codeClass, children, ...codeProps }) => {
              const lang = codeClass?.replace('language-', '') ?? '';
              const text = String(children).replace(/\n$/, '');
              if (lang === 'mermaid') {
                return <MermaidDiagram chart={text} />;
              }
              const isBlock = Boolean(codeClass);
              return isBlock ? (
                <pre className="my-2 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                  <code {...codeProps}>{children}</code>
                </pre>
              ) : (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...codeProps}>
                  {children}
                </code>
              );
            },
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <TableSectionContext.Provider value="thead">
                <thead className="bg-[color-mix(in_oklch,var(--muted)_12%,var(--card))]">{children}</thead>
              </TableSectionContext.Provider>
            ),
            tbody: ({ children }) => (
              <TableSectionContext.Provider value="tbody">
                <tbody>{children}</tbody>
              </TableSectionContext.Provider>
            ),
            th: ({ children }) => (
              <th className="border-b border-[var(--border)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                {children}
              </th>
            ),
            tr: ({ children }) => <AnalysisTableRow>{children}</AnalysisTableRow>,
            td: ({ children }) => (
              <td className="border-[var(--border)] px-3 py-2 align-top text-[var(--foreground)]">{children}</td>
            ),
            li: ({ children }) => <AnalysisListItem>{children}</AnalysisListItem>,
            h1: ({ children }) => <h1 className="mb-2 mt-2 text-lg font-bold">{children}</h1>,
            h2: ({ children }) => <AnalysisHeading level={2}>{children}</AnalysisHeading>,
            h3: ({ children }) => <AnalysisHeading level={3}>{children}</AnalysisHeading>,
          }}
        >
          {raw}
        </ReactMarkdown>
      </div>
    </AnalysisModeContext.Provider>
  );
}
