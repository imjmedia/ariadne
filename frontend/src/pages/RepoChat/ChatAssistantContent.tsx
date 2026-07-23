/**
 * Renderiza respuestas del asistente: MDD JSON (evidence_first), JSON raw_evidence o Markdown (+ Mermaid).
 * La sección «Archivos a tocar» se muestra en un `<details>` colapsado por defecto.
 */
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { MermaidDiagram } from '@/components/MermaidDiagram';
import { ArchivosATocarSection } from './ArchivosATocarSection';
import { splitArchivosATocarSection } from './chat-archivos-section.util';

function tryParseJsonObject(s: string): Record<string, unknown> | null {
  const t = s.trim();
  if (!t.startsWith('{')) return null;
  try {
    const o = JSON.parse(t) as unknown;
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isMddShape(o: Record<string, unknown>): boolean {
  return typeof o.summary === 'string' && Array.isArray(o.evidence_paths);
}

const proseClass =
  '[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_p]:my-1 [&_strong]:font-semibold [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_pre]:overflow-x-auto [&_table]:w-full [&_th]:border [&_td]:border [&_td]:px-2 [&_td]:py-1';

function AssistantMarkdown({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <div className={proseClass}>
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
            <th className="border bg-muted/80 px-2 py-1 text-left font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
          code: ({ className, children, ...props }) => {
            const lang = className?.replace('language-', '') ?? '';
            const text = String(children).replace(/\n$/, '');
            if (lang === 'mermaid') {
              return <MermaidDiagram chart={text} />;
            }
            const isBlock = className?.includes('language-');
            return isBlock ? (
              <pre className="my-2 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                <code {...props}>{children}</code>
              </pre>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ArchivosATocarDetails(props: { title: string; body: string }) {
  return (
    <ArchivosATocarSection
      title={props.title}
      body={props.body}
      renderPreamble={(preamble) => <AssistantMarkdown content={preamble} />}
    />
  );
}

function MarkdownWithCollapsibleArchivos({ content }: { content: string }): ReactNode {
  const { before, section, after } = splitArchivosATocarSection(content);
  if (!section) {
    return <AssistantMarkdown content={content} />;
  }
  return (
    <div className="space-y-1">
      <AssistantMarkdown content={before} />
      <ArchivosATocarDetails title={section.title} body={section.body} />
      <AssistantMarkdown content={after} />
    </div>
  );
}

export function ChatAssistantContent({ content }: { content: string }) {
  const parsed = tryParseJsonObject(content);
  if (parsed) {
    if (parsed.mode === 'raw_evidence') {
      return (
        <div className="space-y-2">
          <Badge variant="secondary" className="text-xs">
            Evidencia bruta (retrieve determinista)
          </Badge>
          <pre className="max-h-[min(70vh,560px)] overflow-auto rounded-md border bg-muted/80 p-3 font-mono text-xs leading-snug">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      );
    }
    if (isMddShape(parsed)) {
      return (
        <div className="space-y-2">
          <Badge variant="default" className="text-xs">
            MDD (evidence_first)
          </Badge>
          <p className="text-sm leading-snug text-muted-foreground">
            JSON de 7 secciones desde Ariadne (una petición). Copiar/pegar o consumir con LegacyCoordinator.
          </p>
          <pre className="max-h-[min(70vh,560px)] overflow-auto rounded-md border bg-muted/80 p-3 font-mono text-xs leading-snug">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      );
    }
  }

  return <MarkdownWithCollapsibleArchivos content={content} />;
}
