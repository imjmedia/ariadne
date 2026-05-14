/**
 * @fileoverview Visor de markdown para secciones de Ayuda. Carga .md desde public y renderiza con ReactMarkdown.
 * Enlaces internos del manual se resuelven a rutas /ayuda/manual/:slug.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const DOCS: Record<string, string> = {
  mcp: '/ayuda-mcp.md',
  skills: '/ayuda-skills.md',
  manual: '/ayuda-manual.md',
  'manual-configuracion': '/ayuda-manual-configuracion.md',
  'manual-indice': '/ayuda-manual-indice.md',
  'manual-architecture': '/ayuda-manual-architecture.md',
  'manual-bitbucket': '/ayuda-manual-bitbucket.md',
  'manual-db-schema': '/ayuda-manual-db-schema.md',
  'manual-indexing': '/ayuda-manual-indexing.md',
  'manual-ingestion': '/ayuda-manual-ingestion.md',
  'manual-chat': '/ayuda-manual-chat.md',
  'manual-mcp-instalacion': '/ayuda-manual-mcp-instalacion.md',
  'manual-parse-refactor': '/ayuda-manual-parse-refactor.md',
};

const MANUAL_HREF_SLUGS: Record<string, string> = {
  'CONFIGURACION_Y_USO.md': 'configuracion',
  'configuracion_y_uso.md': 'configuracion',
  '../README.md': 'indice',
  'README.md': 'indice',
  'docs/README.md': 'indice',
  '../architecture.md': 'architecture',
  'architecture.md': 'architecture',
  '../notebooklm/architecture.md': 'architecture',
  'notebooklm/architecture.md': 'architecture',
  '../bitbucket_webhook.md': 'bitbucket',
  'bitbucket_webhook.md': 'bitbucket',
  '../notebooklm/bitbucket_webhook.md': 'bitbucket',
  'notebooklm/bitbucket_webhook.md': 'bitbucket',
  '../db_schema.md': 'db-schema',
  'db_schema.md': 'db-schema',
  '../notebooklm/db_schema.md': 'db-schema',
  'notebooklm/db_schema.md': 'db-schema',
  '../indexing_engine.md': 'indexing',
  'indexing_engine.md': 'indexing',
  '../notebooklm/indexing_engine.md': 'indexing',
  'notebooklm/indexing_engine.md': 'indexing',
  '../ingestion_flow.md': 'ingestion',
  'ingestion_flow.md': 'ingestion',
  '../notebooklm/ingestion_flow.md': 'ingestion',
  'notebooklm/ingestion_flow.md': 'ingestion',
  '../CHAT_Y_ANALISIS.md': 'chat',
  'CHAT_Y_ANALISIS.md': 'chat',
  '../notebooklm/CHAT_Y_ANALISIS.md': 'chat',
  'notebooklm/CHAT_Y_ANALISIS.md': 'chat',
  '../INSTALACION_MCP_CURSOR.md': 'mcp-instalacion',
  'INSTALACION_MCP_CURSOR.md': 'mcp-instalacion',
  '../notebooklm/INSTALACION_MCP_CURSOR.md': 'mcp-instalacion',
  'notebooklm/INSTALACION_MCP_CURSOR.md': 'mcp-instalacion',
};

function resolveManualHref(href: string): string | null {
  const [path, hash] = href.split('#');
  const clean = path.trim();
  const slug = MANUAL_HREF_SLUGS[clean] ?? MANUAL_HREF_SLUGS[clean.replace(/^\.\.\//, '')];
  return slug ? `/ayuda/manual/${slug}${hash ? `#${hash}` : ''}` : null;
}

const articleClass = cn(
  'markdown-doc max-w-[68rem] space-y-4 text-[15px] leading-relaxed text-[var(--foreground)]',
  '[&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:scroll-mt-28 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-[var(--foreground)]',
  '[&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:scroll-mt-28 [&_h2]:border-b [&_h2]:border-[var(--border)] [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[var(--foreground)]',
  '[&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:scroll-mt-28 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[var(--foreground)]',
  '[&_h4]:mt-6 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-[var(--foreground)]',
  '[&_p]:my-3 [&_p]:text-[var(--foreground)]',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li]:marker:text-[var(--foreground-muted)]',
  '[&_strong]:font-semibold [&_strong]:text-[var(--foreground)]',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--border)] [&_blockquote]:bg-[color-mix(in_oklch,var(--muted)_35%,transparent)] [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:text-[var(--foreground-muted)]',
  '[&_pre]:my-4 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:bg-[color-mix(in_oklch,var(--muted)_42%,var(--card))] [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:shadow-inner',
  '[&_code]:rounded-md [&_code]:border [&_code]:border-[var(--border)] [&_code]:bg-[color-mix(in_oklch,var(--muted)_38%,var(--card))] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]',
  '[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px]',
  '[&_a]:font-medium [&_a]:text-[var(--primary)] [&_a]:underline [&_a]:underline-offset-4 [&_a]:transition-opacity hover:[&_a]:opacity-90',
  '[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-[var(--border)] [&_table]:text-sm',
  '[&_th]:border-b [&_th]:border-[var(--border)] [&_th]:bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border-b [&_td]:border-[var(--border)] [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top',
  '[&_tr:last-child_td]:border-b-0 [&_hr]:my-8 [&_hr]:border-[var(--border)]',
  '[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-[var(--border)]',
);

function CustomLink(props: {
  href?: string;
  children?: React.ReactNode;
  inManualContext?: boolean;
}) {
  const { href, children, inManualContext } = props;
  const cls =
    'font-medium text-[var(--primary)] underline underline-offset-4 transition-opacity hover:opacity-90';
  if (!href) return <span className={cls}>{children}</span>;
  const manualRoute = inManualContext ? resolveManualHref(href) : null;
  const to =
    manualRoute ?? (href.startsWith('/ayuda') || (href.startsWith('/') && !href.startsWith('//')) ? href : null);
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  );
}

export type DocViewerDoc = 'mcp' | 'skills' | 'manual';
export type ManualSlug =
  | 'configuracion'
  | 'indice'
  | 'architecture'
  | 'bitbucket'
  | 'db-schema'
  | 'indexing'
  | 'ingestion'
  | 'chat'
  | 'mcp-instalacion'
  | 'parse-refactor';

export function DocViewer({
  doc,
  manualSlug,
}: {
  doc: DocViewerDoc;
  manualSlug?: ManualSlug | null;
}) {
  const location = useLocation();
  const [md, setMd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const docKey = manualSlug ? `manual-${manualSlug}` : doc;
  const path = DOCS[docKey] ?? DOCS[doc];

  useEffect(() => {
    if (!path) return;
    setMd(null);
    setError(null);
    void fetch(path)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setMd)
      .catch((e: Error) => setError(e.message));
  }, [path]);

  useEffect(() => {
    if (!md) return;
    const hash = location.hash;
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(id) ?? document.querySelector(`[name="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [md, location.hash]);

  const inManualContext = doc === 'manual';

  if (error) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertTitle>No se pudo cargar el documento</AlertTitle>
        <AlertDescription className="text-sm">{error}</AlertDescription>
      </Alert>
    );
  }
  if (!md) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-3/5 max-w-md rounded-lg" />
        <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
        <Skeleton className="h-4 w-11/12 max-w-xl rounded-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-4/5 rounded-md" />
      </div>
    );
  }

  return (
    <article className={articleClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
            <CustomLink href={href} inManualContext={inManualContext}>
              {children}
            </CustomLink>
          ),
        }}
      >
        {md}
      </ReactMarkdown>
    </article>
  );
}
