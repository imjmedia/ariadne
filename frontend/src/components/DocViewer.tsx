/**
 * @fileoverview Visor de markdown para secciones de Ayuda. Carga .md desde public.
 * Render: {@link AriadneMarkdown} con engine TanStack (spike).
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AriadneMarkdown } from '@/components/ariadne-markdown';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    <article>
      <AriadneMarkdown
        content={md}
        variant="docs"
        engine="tanstack"
        renderDocLink={({ href, children }) => (
          <CustomLink href={href} inManualContext={inManualContext}>
            {children}
          </CustomLink>
        )}
      />
    </article>
  );
}
