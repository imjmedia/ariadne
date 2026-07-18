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
import { ChatConversationsMobileToggle } from './RepoChat/ChatConversationsSidebar';
import { ChatConversationsPanel } from './RepoChat/ChatConversationsPanel';
import { ChatMessageThread } from './RepoChat/ChatMessageThread';
import { ChatRepoHeader } from './RepoChat/ChatRepoHeader';
import { useChatPersistence } from './RepoChat/useChatPersistence';
import { useTheForgeChatPromotion } from './RepoChat/useTheForgeChatPromotion';
import {
  chatNavBtnClass,
  chatPageMaxClass,
  chatPageSplitClass,
  panelIntroClass,
  sectionHeaderClass,
  sectionShellClass,
} from './chat/chatShellClasses';

export function RepoChat() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const persistence = useChatPersistence(id ? { kind: 'repository', id } : null);
  const {
    conversations,
    activeConversationId,
    messages,
    setMessages,
    conversationsLoading,
    messagesLoading,
    persistenceError,
    selectConversation,
    deleteConversation,
    startNewConversation,
    ensureActiveConversation,
    persistMessage,
  } = persistence;

  const { available: forgePromotionAvailable } = useTheForgeChatPromotion();

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
    setError(null);
    setMemoryCompactionNote(null);
    void startNewConversation();
  }, [loading, startNewConversation]);

  const send = useCallback(() => {
    if (!id || !input.trim() || loading || messagesLoading) return;
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

    void (async () => {
      let conversationId: string;
      try {
        conversationId = await ensureActiveConversation();
        await persistMessage(conversationId, { role: 'user', content: msg });
      } catch (e) {
        conversationId = activeConversationId ?? '';
        if (!conversationId) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
          return;
        }
      }

      try {
        const res = await api.chat(id, chatPayload);
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
        if (conversationId) {
          await persistMessage(conversationId, {
            role: 'assistant',
            content: res.answer,
            cypher: res.cypher,
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setMessages((m) => [...m, { role: 'assistant', content: `Error: ${message}` }]);
        if (conversationId) {
          try {
            await persistMessage(conversationId, {
              role: 'assistant',
              content: `Error: ${message}`,
            });
          } catch {
            /* ignore persistence error on error bubble */
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [
    id,
    input,
    loading,
    messagesLoading,
    messages,
    setMessages,
    includePrefixesText,
    excludeGlobsText,
    chatPipelineMode,
    ensureActiveConversation,
    persistMessage,
    activeConversationId,
  ]);

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
  const chatBusy = loading || messagesLoading || conversationsLoading;
  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className={chatPageSplitClass}>
      <ChatConversationsPanel
        conversations={conversations}
        activeConversationId={activeConversationId}
        loading={conversationsLoading}
        onSelect={(conversationId) => void selectConversation(conversationId)}
        onCreate={() => void handleNewConversation()}
        onDelete={(conversationId) => void deleteConversation(conversationId)}
        mobileOpen={historyOpen}
        onMobileOpenChange={setHistoryOpen}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4">
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
          newConversationDisabled={chatBusy}
          onOpenAnalysis={() => setAnalysisOpen(true)}
          analysisPending={analysisPending}
          activeConversationId={activeConversationId}
          forgePromoteDisabled={chatBusy || messages.length === 0}
          forgeDefaultStageName={activeConversation?.title ?? undefined}
          forgePromotionAvailable={forgePromotionAvailable}
          headerLeadingExtra={
            <ChatConversationsMobileToggle onOpen={() => setHistoryOpen(true)} />
          }
        />

        <section className={cn(sectionShellClass, 'flex min-h-0 flex-1 flex-col overflow-hidden p-0')}>
          {error ? (
            <Alert variant="destructive" className="mx-4 mt-4 shrink-0 rounded-xl sm:mx-5">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {persistenceError ? (
            <Alert variant="destructive" className="mx-4 mt-4 shrink-0 rounded-xl sm:mx-5">
              <AlertTitle>Historial</AlertTitle>
              <AlertDescription>{persistenceError}</AlertDescription>
            </Alert>
          ) : null}

          {messagesLoading ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <Skeleton className="h-32 w-full max-w-md rounded-xl" />
            </div>
          ) : (
            <ChatMessageThread
              messages={messages}
              loading={loading}
              chatPipelineMode={chatPipelineMode}
              onPromptSelect={(t) => setInput(t.message)}
              scrollRef={scrollRef}
            />
          )}

          <ChatComposer
            input={input}
            onInputChange={setInput}
            onSend={send}
            onKeyDown={handleChatKeyDown}
            loading={chatBusy}
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
    </div>
  );
}
