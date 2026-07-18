/**
 * @fileoverview Chat a nivel proyecto: grafo multi-repo, análisis en panel lateral bajo demanda.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import type { AnalyzeCodeMode, AnalyzeReportMeta, ChatPipelineMode, ChatScope, Project } from '../types';
import { scopeFromAnalyzeForm } from '../utils/analyze-scope-form';
import { buildChatHistoryForRequest, compactChatMessagesInMemory, formatMemoryCompactionNote } from '../utils/chat-history-payload';
import { ingestOptionsFromChatPipelineMode } from '../utils/chat-pipeline-mode';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ChatAnalysisSheet } from './RepoChat/ChatAnalysisSheet';
import { ChatComposer } from './RepoChat/ChatComposer';
import { ChatMessageThread } from './RepoChat/ChatMessageThread';
import { ChatPageHeader } from './RepoChat/ChatPageHeader';
import { ChatProjectScopeOptions } from './RepoChat/ChatProjectScopeOptions';
import {
  chatNavBtnClass,
  chatPageMaxClass,
  panelIntroClass,
  sectionHeaderClass,
  sectionShellClass,
} from './chat/chatShellClasses';

export function ProjectChat() {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
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
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [includePrefixesText, setIncludePrefixesText] = useState('');
  const [excludeGlobsText, setExcludeGlobsText] = useState('');
  const [crossPackageDuplicates, setCrossPackageDuplicates] = useState(false);
  const [memoryCompactionNote, setMemoryCompactionNote] = useState<string | null>(null);
  const [allowBroadProjectChat, setAllowBroadProjectChat] = useState(false);
  const [chatPipelineMode, setChatPipelineMode] = useState<ChatPipelineMode>('default');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!project?.repositories?.length) return;
    setSelectedRepoId((prev) => {
      if (prev && project.repositories.some((r) => r.id === prev)) return prev;
      return project.repositories[0].id;
    });
  }, [project]);

  useEffect(() => {
    if (!projectId) return;
    api
      .getProject(projectId)
      .then(setProject)
      .catch((e) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const runAnalysis = useCallback(
    (mode: AnalyzeCodeMode) => {
      if (!projectId || !project) return;
      setLoadingAnalysis(mode);
      setAnalysisError(null);
      setError(null);
      setAnalysisOpen(true);

      if (mode === 'agents' || mode === 'skill') {
        api
          .analyzeProject(projectId, { mode })
          .then((res) =>
            setAnalysisResult({ mode: res.mode, summary: res.summary, reportMeta: res.reportMeta }),
          )
          .catch((e) => setAnalysisError(e.message))
          .finally(() => setLoadingAnalysis(null));
        return;
      }

      if (project.repositories.length > 1 && !selectedRepoId) {
        setAnalysisError('Selecciona un repositorio para el análisis.');
        setLoadingAnalysis(null);
        return;
      }

      const scope = scopeFromAnalyzeForm(includePrefixesText, excludeGlobsText);
      const payload: {
        mode: 'diagnostico' | 'duplicados' | 'reingenieria' | 'codigo_muerto' | 'seguridad';
        repositoryId?: string;
        scope?: import('../types').ChatScope;
        crossPackageDuplicates?: boolean;
      } = { mode };
      if (project.repositories.length > 1) payload.repositoryId = selectedRepoId;
      if (scope) payload.scope = scope;
      if (mode === 'duplicados' && crossPackageDuplicates) payload.crossPackageDuplicates = true;

      api
        .analyzeProject(projectId, payload)
        .then((res) =>
          setAnalysisResult({ mode: res.mode, summary: res.summary, reportMeta: res.reportMeta }),
        )
        .catch((e) => setAnalysisError(e.message))
        .finally(() => setLoadingAnalysis(null));
    },
    [projectId, project, selectedRepoId, includePrefixesText, excludeGlobsText, crossPackageDuplicates],
  );

  const handleNewConversation = useCallback(() => {
    if (loading) return;
    setMessages([]);
    setError(null);
    setMemoryCompactionNote(null);
  }, [loading]);

  const send = useCallback(() => {
    if (!projectId || !project || !input.trim() || loading) return;
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
    const fromForm = scopeFromAnalyzeForm(includePrefixesText, excludeGlobsText);
    let scope: ChatScope | undefined = fromForm;
    if (project.repositories.length > 1 && !allowBroadProjectChat && selectedRepoId) {
      scope = { ...(fromForm ?? {}), repoIds: [selectedRepoId] };
    }
    const hasScope =
      scope &&
      ((scope.repoIds?.length ?? 0) > 0 ||
        (scope.includePathPrefixes?.length ?? 0) > 0 ||
        (scope.excludePathGlobs?.length ?? 0) > 0);

    const modeOpts = ingestOptionsFromChatPipelineMode(chatPipelineMode);
    const chatBody: Parameters<typeof api.chatProject>[1] = {
      message: msg,
      history,
      ...modeOpts,
      ...(hasScope ? { scope } : {}),
    };
    if (project.repositories.length > 1 && allowBroadProjectChat) {
      chatBody.strictChatScope = false;
    }

    api
      .chatProject(projectId, chatBody)
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
  }, [
    projectId,
    project,
    input,
    loading,
    messages,
    allowBroadProjectChat,
    selectedRepoId,
    includePrefixesText,
    excludeGlobsText,
    chatPipelineMode,
  ]);

  function handleChatKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!projectId) return null;

  if (error && !project) {
    return (
      <div className={cn(chatPageMaxClass, 'space-y-4 pb-8')}>
        <Button variant="outline" size="sm" className={chatNavBtnClass} asChild>
          <Link to="/projects">
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Proyectos
          </Link>
        </Button>
        <div className={panelIntroClass}>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Chat del proyecto</h2>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">No se pudo cargar el proyecto.</p>
        </div>
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={cn(chatPageMaxClass, 'space-y-4 pb-8')}>
        <Button variant="outline" size="sm" className={chatNavBtnClass} asChild>
          <Link to="/projects">
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Proyectos
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

  const displayName =
    project.name?.trim() ||
    (project.repositories[0]
      ? `${project.repositories[0].projectKey}/${project.repositories[0].repoSlug}`
      : null) ||
    projectId.slice(0, 8);

  const repoCount = project.repositories.length;
  const analysisPending = Boolean(analysisResult || loadingAnalysis || analysisError);
  const codeAnalysisDisabled = repoCount === 0 || (repoCount > 1 && !selectedRepoId);

  return (
    <div
      className={cn(
        chatPageMaxClass,
        'flex min-h-0 flex-1 flex-col pb-4 xl:h-[min(calc(100dvh-9.25rem),900px)] xl:pb-0',
      )}
    >
      <ChatPageHeader
        backHref={`/projects/${projectId}`}
        backLabel="Volver al proyecto"
        eyebrow="Chat del proyecto"
        title={displayName}
        subtitle={
          repoCount === 1 ? '1 repositorio indexado' : `${repoCount} repositorios indexados`
        }
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
        modeSelectId="project-chat-mode-popover"
        extraBadges={
          allowBroadProjectChat && repoCount > 1 ? (
            <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[10px]">
              Chat amplio
            </Badge>
          ) : null
        }
        optionsExtra={
          <ChatProjectScopeOptions
            repositories={project.repositories}
            selectedRepoId={selectedRepoId}
            onSelectedRepoIdChange={setSelectedRepoId}
            allowBroadProjectChat={allowBroadProjectChat}
            onAllowBroadProjectChatChange={setAllowBroadProjectChat}
          />
        }
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
          emptyTitle="Consulta multi-repo"
          emptyDescription="Pregunta por archivos o flujos en cualquier repositorio del proyecto. Ariadne usa el grafo unificado."
        />

        <ChatComposer
          input={input}
          onInputChange={setInput}
          onSend={send}
          onKeyDown={handleChatKeyDown}
          loading={loading}
          placeholder="¿Qué quieres saber del proyecto?"
        />
      </section>

      <ChatAnalysisSheet
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        title="Análisis del proyecto"
        description="Informes por repositorio o AGENTS/SKILL a nivel proyecto."
        loadingAnalysis={loadingAnalysis}
        analysisError={analysisError}
        analysisResult={analysisResult}
        onRunAnalysis={runAnalysis}
        codeAnalysisDisabled={codeAnalysisDisabled}
        projectRepos={project.repositories}
        selectedRepoId={selectedRepoId}
        onSelectedRepoIdChange={setSelectedRepoId}
        indexHref={selectedRepoId ? `/repos/${selectedRepoId}/index` : null}
        showFullAudit={false}
      />
    </div>
  );
}
