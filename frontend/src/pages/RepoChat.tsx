/**
 * @fileoverview Página de chat con repo: NL→Cypher, análisis (diagnóstico, duplicados, reingeniería, código muerto, seguridad, AGENTS, SKILL), Full Audit, Ver índice.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ChevronDown, Send } from 'lucide-react';
import { MarkdownBlock } from '@/components/MarkdownBlock';
import { AnalyzeReportMetaBadges } from '@/components/analyze/AnalyzeReportMetaBadges';
import { AnalyzeScopeFields } from '@/components/analyze/AnalyzeScopeFields';
import { api } from '../api';
import type { AnalyzeCodeMode, AnalyzeReportMeta, ChatPipelineMode, Repository } from '../types';
import { scopeFromAnalyzeForm } from '../utils/analyze-scope-form';
import { buildChatHistoryForRequest, compactChatMessagesInMemory, formatMemoryCompactionNote } from '../utils/chat-history-payload';
import { ingestOptionsFromChatPipelineMode } from '../utils/chat-pipeline-mode';
import { ChatAssistantContent } from './RepoChat/ChatAssistantContent';
import { ChatConversationToolbar } from './RepoChat/ChatConversationToolbar';
import { ChatPipelineModeSelect } from './RepoChat/ChatPipelineModeSelect';
import { Button } from '@/components/ui/button';
import { FullAuditModal } from './RepoChat/FullAuditModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ChatMobileTabs, type ChatMobileTabId } from './chat/ChatMobileTabs';
import {
  chatAnalysisBtnClass,
  chatBubbleAssistantClass,
  chatBubbleUserClass,
  chatEmptyStateClass,
  chatMarkdownBoxClass,
  chatNavBtnClass,
  chatPageMaxClass,
  panelIntroClass,
  sectionHeaderClass,
  sectionShellClass,
} from './chat/chatShellClasses';

/** Mensaje del chat: user o assistant, contenido y cypher opcional. */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  cypher?: string;
}

const ANALYSIS_MODE_LABELS: Record<string, string> = {
  diagnostico: 'Diagnóstico',
  duplicados: 'Duplicados',
  reingenieria: 'Reingeniería',
  codigo_muerto: 'Código muerto',
  seguridad: 'Seguridad',
  agents: 'AGENTS',
  skill: 'SKILL',
};
const ANALYSIS_RESULT_TITLES: Record<string, string> = {
  diagnostico: 'Deuda técnica',
  duplicados: 'Código duplicado',
  codigo_muerto: 'Código muerto',
  reingenieria: 'Reingeniería',
  seguridad: 'Auditoría de seguridad',
  agents: 'AGENTS.md',
  skill: 'SKILL.md',
};

const userMarkdownProseClass = cn(
  '[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_p]:my-1 [&_strong]:font-semibold [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_pre]:overflow-x-auto [&_table]:w-full [&_th]:border [&_th]:border-[var(--border)] [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-2 [&_td]:py-1',
);

const composerTextareaClass = cn(
  'min-h-[5.25rem] flex-1 resize-none rounded-xl border-0 bg-transparent text-sm shadow-none',
  'placeholder:text-[var(--foreground-muted)]',
  'focus-visible:outline-none focus-visible:ring-0',
);

/**
 * Página de chat con repo: preguntas NL→Cypher, análisis y Full Audit.
 * Por debajo del breakpoint xl: pestañas a pantalla completa. Desde xl: panel único partido (chat a la izquierda, herramientas a la derecha).
 */
export function RepoChat() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    mode: string;
    summary: string;
    reportMeta?: AnalyzeReportMeta;
  } | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [includePrefixesText, setIncludePrefixesText] = useState('');
  const [excludeGlobsText, setExcludeGlobsText] = useState('');
  const [crossPackageDuplicates, setCrossPackageDuplicates] = useState(false);
  const [fullAuditOpen, setFullAuditOpen] = useState(false);
  const [fullAuditData, setFullAuditData] = useState<import('../types').FullAuditResult | null>(null);
  const [fullAuditLoading, setFullAuditLoading] = useState(false);
  const [fullAuditError, setFullAuditError] = useState<string | null>(null);
  const [chatPipelineMode, setChatPipelineMode] = useState<ChatPipelineMode>('default');
  const [memoryCompactionNote, setMemoryCompactionNote] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<ChatMobileTabId>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getRepository(id)
      .then(setRepo)
      .catch((e) => setError(e.message));
  }, [id]);

  const runAnalysis = useCallback(
    (mode: AnalyzeCodeMode) => {
      if (!id) return;
      setLoadingAnalysis(mode);
      setAnalysisError(null);
      setError(null);
      setMobileTab('tools');
      const scope = scopeFromAnalyzeForm(includePrefixesText, excludeGlobsText);
      const opts: { scope?: import('../types').ChatScope; crossPackageDuplicates?: boolean } = {};
      if (scope) opts.scope = scope;
      if (mode === 'duplicados' && crossPackageDuplicates) opts.crossPackageDuplicates = true;
      const reqOpts = Object.keys(opts).length > 0 ? opts : undefined;
      api
        .analyze(id, mode, reqOpts)
        .then((res) =>
          setAnalysisResult({ mode: res.mode, summary: res.summary, reportMeta: res.reportMeta }),
        )
        .catch((e) => {
          setAnalysisError(e.message);
        })
        .finally(() => setLoadingAnalysis(null));
    },
    [id, includePrefixesText, excludeGlobsText, crossPackageDuplicates],
  );

  const runFullAudit = useCallback(() => {
    if (!id) return;
    setMobileTab('tools');
    setFullAuditOpen(true);
    setFullAuditLoading(true);
    setFullAuditError(null);
    setFullAuditData(null);
    api
      .getFullAudit(id)
      .then(setFullAuditData)
      .catch((e) => setFullAuditError(e.message))
      .finally(() => setFullAuditLoading(false));
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewConversation = useCallback(() => {
    if (loading) return;
    setMessages([]);
    setError(null);
    setMemoryCompactionNote(null);
  }, [loading]);

  const send = useCallback(() => {
    if (!id || !input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setLoading(true);
    setError(null);
    setMobileTab('chat');

    const {
      messages: prevForHistory,
      compacted: prevCompacted,
      droppedCount,
    } = compactChatMessagesInMemory(messages);
    const prevNote = formatMemoryCompactionNote({
      messages: prevForHistory,
      compacted: prevCompacted,
      droppedCount,
    });
    if (prevNote) setMemoryCompactionNote(prevNote);

    setMessages(() => [...prevForHistory, { role: 'user', content: msg }]);

    const history = buildChatHistoryForRequest(prevForHistory);

    const scope = scopeFromAnalyzeForm(includePrefixesText, excludeGlobsText);
    const modeOpts = ingestOptionsFromChatPipelineMode(chatPipelineMode);
    const chatPayload = {
      message: msg,
      history,
      ...(scope ? { scope } : {}),
      ...modeOpts,
    };

    api
      .chat(id, chatPayload)
      .then((res) => {
        setMessages((m) => {
          const withNew: ChatMessage[] = [
            ...m,
            { role: 'assistant', content: res.answer, cypher: res.cypher },
          ];
          const compacted = compactChatMessagesInMemory(withNew);
          const note = formatMemoryCompactionNote(compacted);
          if (note) setMemoryCompactionNote(note);
          return compacted.messages;
        });
      })
      .catch((e) => {
        setError(e.message);
        setMessages((m) => [...m, { role: 'assistant', content: `Error: ${e.message}` }]);
      })
      .finally(() => setLoading(false));
  }, [id, input, loading, messages, includePrefixesText, excludeGlobsText, chatPipelineMode]);

  /** Envía mensaje con Enter (sin Shift). */
  function handleChatKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!id) return null;
  if (error && !repo) {
    return (
      <div className={cn(chatPageMaxClass, 'space-y-4 pb-8')}>
        <Button variant="outline" size="sm" className={chatNavBtnClass} asChild>
          <Link to="/repos">
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Repos
          </Link>
        </Button>
        <div className={panelIntroClass}>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Chat</h2>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">No se pudo cargar el repositorio.</p>
        </div>
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!repo) {
    return (
      <div className={cn(chatPageMaxClass, 'space-y-4 pb-8')}>
        <Button variant="outline" size="sm" className={chatNavBtnClass} asChild>
          <Link to="/repos">
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Repos
          </Link>
        </Button>
        <section className={sectionShellClass}>
          <div className={sectionHeaderClass}>
            <Skeleton className="h-7 w-64 max-w-full rounded-lg" />
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className={cn(
        chatPageMaxClass,
        'flex flex-col pb-4 xl:min-h-0 xl:flex-1 xl:pb-0 xl:h-[min(calc(100dvh-9.25rem),900px)]',
      )}
    >
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className={chatNavBtnClass} asChild>
            <Link to="/repos">
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Repos
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" className={chatNavBtnClass} asChild>
            <Link to={`/repos/${id}`}>Detalle</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" className={chatNavBtnClass} asChild>
            <Link to={`/repos/${id}/index`}>Índice</Link>
          </Button>
        </div>
        <div
          className={cn(
            panelIntroClass,
            'min-w-0 flex-1 py-3 sm:max-w-[min(100%,52rem)] sm:flex-none sm:px-5 sm:py-3',
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
            Chat del repositorio
          </p>
          <p className="mt-1 break-all font-mono text-sm font-semibold text-[var(--foreground)] sm:break-words sm:text-base">
            {repo.projectKey}/{repo.repoSlug}
          </p>
        </div>
      </header>

      <ChatMobileTabs value={mobileTab} onChange={setMobileTab} toolsLabel="Análisis y alcance" />

      <div
        className={cn(
          sectionShellClass,
          'flex min-h-0 flex-1 flex-col overflow-hidden p-0 xl:flex-row xl:flex-row-reverse',
        )}
      >
        <aside
          className={cn(
            'flex min-h-0 w-full flex-col overflow-hidden border-t border-[var(--border)] xl:order-2 xl:w-[min(100%,480px)] xl:max-w-[44%] xl:shrink-0 xl:border-t-0',
            mobileTab !== 'tools' && 'max-xl:hidden',
          )}
        >
          <div className={sectionHeaderClass}>
            <h2 className="text-base font-semibold text-[var(--foreground)]">Herramientas</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)] sm:text-sm">
              Análisis sobre el código indexado; el alcance es opcional.
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 space-y-3 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_4%,var(--card))] px-4 py-3 sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
                Análisis rápido
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('diagnostico')}
                  disabled={!!loadingAnalysis}
                >
                  {loadingAnalysis === 'diagnostico' ? '…' : 'Diagnóstico'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('duplicados')}
                  disabled={!!loadingAnalysis}
                >
                  {loadingAnalysis === 'duplicados' ? '…' : 'Duplicados'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('reingenieria')}
                  disabled={!!loadingAnalysis}
                >
                  {loadingAnalysis === 'reingenieria' ? '…' : 'Reingeniería'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('codigo_muerto')}
                  disabled={!!loadingAnalysis}
                >
                  {loadingAnalysis === 'codigo_muerto' ? '…' : 'Código muerto'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('seguridad')}
                  disabled={!!loadingAnalysis}
                  title="Heurística: secretos expuestos en fuentes indexadas (no sustituye SAST/pentest)"
                >
                  {loadingAnalysis === 'seguridad' ? '…' : 'Seguridad'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('agents')}
                  disabled={!!loadingAnalysis}
                  title="Genera AGENTS.md para agentes AI (protocolo, herramientas, flujos)"
                >
                  {loadingAnalysis === 'agents' ? '…' : 'AGENTS'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('skill')}
                  disabled={!!loadingAnalysis}
                  title="Genera SKILL.md para Cursor/Claude (instrucciones, ejemplos, troubleshooting)"
                >
                  {loadingAnalysis === 'skill' ? '…' : 'SKILL'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={runFullAudit}
                  disabled={!!loadingAnalysis}
                  title="Auditoría completa: arquitectura, seguridad, deuda técnica"
                >
                  Full Audit
                </Button>
                <Button type="button" variant="outline" className={chatAnalysisBtnClass} asChild>
                  <Link to={`/repos/${id}/index`}>Ver índice</Link>
                </Button>
              </div>
              <details className="group rounded-xl border border-[var(--border)] bg-[var(--card)] open:shadow-sm">
                <summary className="flex list-none cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
                  <span>Alcance opcional y ayuda</span>
                  <ChevronDown
                    className="size-4 shrink-0 text-[var(--foreground-muted)] transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-3 pb-3 pt-3">
                  <AnalyzeScopeFields
                    includePrefixesText={includePrefixesText}
                    onIncludePrefixesText={setIncludePrefixesText}
                    excludeGlobsText={excludeGlobsText}
                    onExcludeGlobsText={setExcludeGlobsText}
                    crossPackageDuplicates={crossPackageDuplicates}
                    onCrossPackageDuplicates={setCrossPackageDuplicates}
                    showCrossPackage
                  />
                  <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
                    El alcance se reutiliza en el <strong className="text-[var(--foreground)]">chat</strong> como{' '}
                    <code className="rounded-md bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))] px-1.5 py-0.5 font-mono text-[11px] text-[var(--foreground)]">
                      scope
                    </code>{' '}
                    para menos tokens y menos 429.
                  </p>
                </div>
              </details>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden bg-[color-mix(in_oklch,var(--muted)_6%,var(--card))] px-4 py-4 sm:px-5 sm:py-5">
              <FullAuditModal
                open={fullAuditOpen}
                onOpenChange={setFullAuditOpen}
                data={fullAuditData}
                loading={fullAuditLoading}
                error={fullAuditError}
              />

              {loadingAnalysis ? (
                <section className={sectionShellClass}>
                  <div className={sectionHeaderClass}>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {ANALYSIS_MODE_LABELS[loadingAnalysis] ?? loadingAnalysis}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 px-5 py-8 text-sm text-[var(--foreground-muted)] sm:px-6">
                    <span
                      className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                    Analizando…
                  </div>
                </section>
              ) : null}

              {analysisError && !loadingAnalysis ? (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertTitle>Error en el análisis</AlertTitle>
                  <AlertDescription>{analysisError}</AlertDescription>
                </Alert>
              ) : null}

              {analysisResult && !loadingAnalysis ? (
                <section className={cn(sectionShellClass, 'flex min-h-0 flex-col')}>
                  <div className={sectionHeaderClass}>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {ANALYSIS_RESULT_TITLES[analysisResult.mode] ?? analysisResult.mode}
                    </h3>
                    <AnalyzeReportMetaBadges meta={analysisResult.reportMeta} />
                    {analysisResult.reportMeta?.graphCoverageNote ? (
                      <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-muted)]">
                        {analysisResult.reportMeta.graphCoverageNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex min-h-0 flex-col p-4 sm:p-5">
                    <div className={chatMarkdownBoxClass}>
                      <MarkdownBlock
                        content={
                          typeof analysisResult.summary === 'string'
                            ? analysisResult.summary
                            : String(analysisResult.summary ?? '')
                        }
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              {!analysisResult && !loadingAnalysis && !analysisError && !fullAuditOpen ? (
                <p className="py-6 text-center text-xs leading-relaxed text-[var(--foreground-muted)]">
                  Los informes aparecerán aquí al ejecutar un análisis o Full Audit.
                </p>
              ) : null}
            </div>
          </div>
        </aside>

        <section
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b border-[var(--border)] xl:order-1 xl:border-b-0 xl:border-r',
            mobileTab !== 'chat' && 'max-xl:hidden',
          )}
        >
          <div className={sectionHeaderClass}>
            <h2 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">Pregunta al grafo</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">
              NL → Cypher sobre FalkorDB. Modo de pipeline arriba; escribe abajo.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 space-y-3 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_6%,var(--card))] px-4 py-3 sm:px-5 sm:py-4">
              <ChatConversationToolbar
                messageCount={messages.length}
                memoryNote={memoryCompactionNote}
                onNewConversation={handleNewConversation}
                loading={loading}
              />
              <ChatPipelineModeSelect
                value={chatPipelineMode}
                onChange={setChatPipelineMode}
                id="repo-chat-mode"
                density="compact"
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
              {error ? (
                <Alert variant="destructive" className="mb-3 shrink-0 rounded-xl">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="mx-auto min-h-0 w-full max-w-[42rem] flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-1 sm:px-2">
                {messages.length === 0 ? (
                  <div className={chatEmptyStateClass}>
                    <p className="text-sm font-medium text-[var(--foreground)]">Empieza una conversación</p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
                      Pregunta por componentes, imports o patrones. El asistente ejecuta Cypher sobre el grafo del
                      repo.
                    </p>
                  </div>
                ) : null}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn('flex flex-col gap-1', m.role === 'user' ? 'items-end' : 'items-start')}
                  >
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
                              code: ({ className, children, ...props }) => {
                                const isBlock = className?.includes('language-');
                                return isBlock ? (
                                  <pre className="my-2 overflow-x-auto rounded-lg bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] p-2 font-mono text-xs">
                                    <code {...props}>{children}</code>
                                  </pre>
                                ) : (
                                  <code
                                    className="rounded-md bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-1 py-0.5 font-mono text-xs"
                                    {...props}
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
                        <pre className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_28%,var(--card))] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--foreground)]">
                          {m.cypher}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                ))}
                {loading ? (
                  <div className="flex flex-col gap-1 items-start">
                    <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
                      Ariadne
                    </span>
                    <div
                      className={cn(
                        chatBubbleAssistantClass,
                        'flex items-center gap-2 text-[var(--foreground-muted)]',
                      )}
                    >
                      <span
                        className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                        aria-hidden
                      />
                      {chatPipelineMode === 'evidence_first'
                        ? 'Generando MDD (30–120 s)…'
                        : chatPipelineMode === 'raw_evidence_fast'
                          ? 'Recolectando evidencia…'
                          : 'Generando respuesta…'}
                    </div>
                  </div>
                ) : null}
                <div ref={scrollRef} className="h-px shrink-0" aria-hidden />
              </div>

              <div className="shrink-0 border-t border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_8%,var(--card))] px-2 pb-2 pt-3 sm:px-3 sm:pb-3 sm:pt-4">
                <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm sm:flex-row sm:items-end sm:gap-3 sm:p-3">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="¿Qué quieres saber del código indexado?"
                    rows={3}
                    disabled={loading}
                    className={composerTextareaClass}
                    aria-label="Mensaje al chat"
                  />
                  <Button
                    type="button"
                    onClick={send}
                    disabled={loading || !input.trim()}
                    className="h-11 w-full shrink-0 gap-2 rounded-xl touch-manipulation sm:w-auto sm:min-w-[7.5rem] sm:self-end"
                  >
                    <Send className="size-4 shrink-0" aria-hidden />
                    Enviar
                  </Button>
                </div>
                <p className="mt-2 text-center text-[11px] text-[var(--foreground-muted)] sm:text-left">
                  <kbd className="rounded border border-[var(--border)] bg-[var(--card)] px-1 py-0.5 font-mono text-[10px]">
                    Enter
                  </kbd>{' '}
                  envía ·{' '}
                  <kbd className="rounded border border-[var(--border)] bg-[var(--card)] px-1 py-0.5 font-mono text-[10px]">
                    Mayús+Enter
                  </kbd>{' '}
                  nueva línea
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
