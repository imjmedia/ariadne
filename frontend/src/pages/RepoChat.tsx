/**
 * @fileoverview Página de chat con repo: NL→Cypher, análisis en panel lateral bajo demanda.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import type { AnalyzeCodeMode, AnalyzeReportMeta, ChatPipelineMode, Repository } from '../types';
import { scopeFromAnalyzeForm } from '../utils/analyze-scope-form';
import { buildChatHistoryForRequest, compactChatMessagesInMemory, formatMemoryCompactionNote } from '../utils/chat-history-payload';
import { ingestOptionsFromChatPipelineMode } from '../utils/chat-pipeline-mode';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ChatAnalysisSheet } from './RepoChat/ChatAnalysisSheet';
import { ChatComposer } from './RepoChat/ChatComposer';
import { ChatMessageThread } from './RepoChat/ChatMessageThread';
import { ChatRepoHeader } from './RepoChat/ChatRepoHeader';
import {
  chatNavBtnClass,
  chatPageMaxClass,
  panelIntroClass,
  sectionHeaderClass,
  sectionShellClass,
} from './chat/chatShellClasses';

export function RepoChat() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; cypher?: string }>>([]);
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
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [fullAuditOpen, setFullAuditOpen] = useState(false);
  const [fullAuditData, setFullAuditData] = useState<import('../types').FullAuditResult | null>(null);
  const [fullAuditLoading, setFullAuditLoading] = useState(false);
  const [fullAuditError, setFullAuditError] = useState<string | null>(null);
  const [chatPipelineMode, setChatPipelineMode] = useState<ChatPipelineMode>('default');
  const [memoryCompactionNote, setMemoryCompactionNote] = useState<string | null>(null);
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
      setAnalysisOpen(true);
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
    setAnalysisOpen(true);
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
          const withNew = [
            ...m,
            { role: 'assistant' as const, content: res.answer, cypher: res.cypher },
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

  const analysisPending = Boolean(analysisResult || loadingAnalysis || analysisError);

  return (
    <div
      className={cn(
        chatPageMaxClass,
        'flex min-h-0 flex-1 flex-col pb-4 xl:h-[min(calc(100dvh-9.25rem),900px)] xl:pb-0',
      )}
    >
      <ChatRepoHeader
        repo={repo}
        repoId={id}
        chatPipelineMode={chatPipelineMode}
        onChatPipelineModeChange={setChatPipelineMode}
        includePrefixesText={includePrefixesText}
        onIncludePrefixesText={setIncludePrefixesText}
        excludeGlobsText={excludeGlobsText}
        onExcludeGlobsText={setExcludeGlobsText}
        crossPackageDuplicates={crossPackageDuplicates}
        onCrossPackageDuplicates={setCrossPackageDuplicates}
        memoryNote={memoryCompactionNote}
        messageCount={messages.length}
        onNewConversation={handleNewConversation}
        canClearConversation={messages.length > 0 && !loading}
        onOpenAnalysis={() => setAnalysisOpen(true)}
        analysisPending={analysisPending}
      />

      <section className={cn(sectionShellClass, 'flex min-h-0 flex-1 flex-col overflow-hidden p-0')}>
        {error ? (
          <Alert variant="destructive" className="mx-4 mt-4 shrink-0 rounded-xl sm:mx-5">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <ChatMessageThread
          messages={messages}
          loading={loading}
          chatPipelineMode={chatPipelineMode}
          onPromptSelect={(t) => setInput(t.message)}
          scrollRef={scrollRef}
        />

        <ChatComposer
          input={input}
          onInputChange={setInput}
          onSend={send}
          onKeyDown={handleChatKeyDown}
          loading={loading}
        />
      </section>

      <ChatAnalysisSheet
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        indexHref={`/repos/${id}/index`}
        loadingAnalysis={loadingAnalysis}
        analysisError={analysisError}
        analysisResult={analysisResult}
        onRunAnalysis={runAnalysis}
        onRunFullAudit={runFullAudit}
        fullAuditOpen={fullAuditOpen}
        onFullAuditOpenChange={setFullAuditOpen}
        fullAuditData={fullAuditData}
        fullAuditLoading={fullAuditLoading}
        fullAuditError={fullAuditError}
      />
    </div>
  );
}
