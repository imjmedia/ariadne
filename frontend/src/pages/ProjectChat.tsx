/**
 * @fileoverview Chat a nivel proyecto: consulta el grafo de todos los repos del proyecto.
 * Multi-root: opción chat amplio (`strictChatScope: false`). Análisis por repo con alcance opcional; AGENTS/SKILL a nivel proyecto.
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
import type { AnalyzeCodeMode, AnalyzeReportMeta, ChatPipelineMode, ChatScope, Project } from '../types';
import { scopeFromAnalyzeForm } from '../utils/analyze-scope-form';
import { ingestOptionsFromChatPipelineMode } from '../utils/chat-pipeline-mode';
import { ChatAssistantContent } from './RepoChat/ChatAssistantContent';
import { ChatPipelineModeSelect } from './RepoChat/ChatPipelineModeSelect';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  cypher?: string;
  result?: unknown[];
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

/** Chat a nivel proyecto: consulta el grafo de todos los repos del proyecto (POST /projects/:id/chat). */
export function ProjectChat() {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
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
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [includePrefixesText, setIncludePrefixesText] = useState('');
  const [excludeGlobsText, setExcludeGlobsText] = useState('');
  const [crossPackageDuplicates, setCrossPackageDuplicates] = useState(false);
  /** Multi-root: `false` → envía `strictChatScope: false` (chat sobre todos los roots sin exigir scope). */
  const [allowBroadProjectChat, setAllowBroadProjectChat] = useState(false);
  const [chatPipelineMode, setChatPipelineMode] = useState<ChatPipelineMode>('default');
  const [mobileTab, setMobileTab] = useState<ChatMobileTabId>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!project?.repositories?.length) return;
    setSelectedRepoId((prev) => {
      if (prev && project.repositories.some((r) => r.id === prev)) return prev;
      return project.repositories[0].id;
    });
  }, [project]);

  const runAnalysis = useCallback(
    (mode: AnalyzeCodeMode) => {
      if (!projectId || !project) return;
      setLoadingAnalysis(mode);
      setAnalysisError(null);
      setError(null);
      setMobileTab('tools');

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
    [
      projectId,
      project,
      selectedRepoId,
      includePrefixesText,
      excludeGlobsText,
      crossPackageDuplicates,
    ],
  );

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

  /** Envía mensaje al chat del proyecto (POST /projects/:id/chat) y actualiza mensajes. */
  const send = useCallback(() => {
    if (!projectId || !project || !input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setLoading(true);
    setError(null);
    setMobileTab('chat');

    const history = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
      cypher: m.cypher,
      result: m.result,
    }));

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
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: res.answer,
            cypher: res.cypher,
            result: res.result,
          },
        ]);
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

  /** Envía mensaje con Enter (sin Shift). */
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
            <Link to="/projects">
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Proyectos
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" className={chatNavBtnClass} asChild>
            <Link to={`/projects/${projectId}`}>Detalle</Link>
          </Button>
        </div>
        <div
          className={cn(
            panelIntroClass,
            'min-w-0 flex-1 py-3 sm:max-w-[min(100%,52rem)] sm:flex-none sm:px-5 sm:py-3',
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
            Chat del proyecto
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--foreground)] sm:line-clamp-none sm:text-base">
            {displayName}
          </p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            {project.repositories.length === 1
              ? '1 repositorio indexado'
              : `${project.repositories.length} repositorios indexados`}
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
              Análisis por repo y alcance opcional.
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 space-y-3 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_4%,var(--card))] px-4 py-3 sm:px-5">
              {project.repositories.length > 1 ? (
                <div className="space-y-2">
                  <Label htmlFor="project-chat-repo" className="text-xs font-medium text-[var(--foreground-muted)]">
                    Repositorio para análisis de código
                  </Label>
                  <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
                    <SelectTrigger id="project-chat-repo" size="sm" className="h-11 w-full rounded-xl font-mono text-xs">
                      <SelectValue placeholder="Elegir repositorio" />
                    </SelectTrigger>
                    <SelectContent>
                      {project.repositories.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="font-mono text-xs">
                          {r.projectKey}/{r.repoSlug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
                Análisis rápido
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('diagnostico')}
                  disabled={!!loadingAnalysis || project.repositories.length === 0}
                >
                  {loadingAnalysis === 'diagnostico' ? '…' : 'Diagnóstico'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('duplicados')}
                  disabled={!!loadingAnalysis || project.repositories.length === 0}
                >
                  {loadingAnalysis === 'duplicados' ? '…' : 'Duplicados'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('reingenieria')}
                  disabled={!!loadingAnalysis || project.repositories.length === 0}
                >
                  {loadingAnalysis === 'reingenieria' ? '…' : 'Reingeniería'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('codigo_muerto')}
                  disabled={!!loadingAnalysis || project.repositories.length === 0}
                >
                  {loadingAnalysis === 'codigo_muerto' ? '…' : 'Código muerto'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('seguridad')}
                  disabled={!!loadingAnalysis || project.repositories.length === 0}
                  title="Heurística: secretos en fuentes indexadas"
                >
                  {loadingAnalysis === 'seguridad' ? '…' : 'Seguridad'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('agents')}
                  disabled={!!loadingAnalysis}
                  title="Genera AGENTS.md para agentes AI"
                >
                  {loadingAnalysis === 'agents' ? '…' : 'AGENTS'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={chatAnalysisBtnClass}
                  onClick={() => runAnalysis('skill')}
                  disabled={!!loadingAnalysis}
                  title="Genera SKILL.md para Cursor/Claude"
                >
                  {loadingAnalysis === 'skill' ? '…' : 'SKILL'}
                </Button>
                {selectedRepoId ? (
                  <Button type="button" variant="outline" className={chatAnalysisBtnClass} asChild>
                    <Link to={`/repos/${selectedRepoId}/index`}>Ver índice</Link>
                  </Button>
                ) : null}
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
                    Con varios repos y sin chat amplio, el chat envía{' '}
                    <code className="rounded-md bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))] px-1.5 py-0.5 font-mono text-[11px] text-[var(--foreground)]">
                      scope.repoIds
                    </code>{' '}
                    del repo elegido más prefijos/globs.
                  </p>
                </div>
              </details>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden bg-[color-mix(in_oklch,var(--muted)_6%,var(--card))] px-4 py-4 sm:px-5 sm:py-5">
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
                    Generando…
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
              {!analysisResult && !loadingAnalysis && !analysisError ? (
                <p className="py-6 text-center text-xs leading-relaxed text-[var(--foreground-muted)]">
                  Los informes aparecerán aquí al ejecutar un análisis.
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
            <h2 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">Pregunta al proyecto</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">
              Grafo multi-repo. Modo de pipeline arriba; opción «chat amplio» si aplica.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 space-y-3 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_6%,var(--card))] px-4 py-3 sm:px-5 sm:py-4">
              <ChatPipelineModeSelect
                value={chatPipelineMode}
                onChange={setChatPipelineMode}
                id="project-chat-mode"
                density="compact"
              />
              {project.repositories.length > 1 ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)]/80 bg-[var(--card)]/80 p-3 text-xs transition-colors hover:bg-[var(--card)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 rounded border-[var(--border)] bg-[var(--card)] text-[var(--primary)] accent-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/15 focus-visible:ring-offset-0"
                    checked={allowBroadProjectChat}
                    onChange={(e) => setAllowBroadProjectChat(e.target.checked)}
                  />
                  <span className="leading-snug text-[var(--foreground-muted)]">
                    <span className="font-medium text-[var(--foreground)]">Chat amplio</span>: no exigir scope (
                    <code className="rounded bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] px-1 font-mono text-[11px]">
                      strictChatScope: false
                    </code>
                    ). Si está desmarcado y el mensaje no acota repo, la API puede responder{' '}
                    <code className="rounded bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] px-1 font-mono text-[11px]">
                      [AMBIGUOUS_SCOPE]
                    </code>
                    .
                  </span>
                </label>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
              {error ? (
                <Alert variant="destructive" className="mb-3 shrink-0 rounded-xl">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="mx-auto min-h-0 w-full max-w-[42rem] flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-1 sm:px-2">
                {messages.length === 0 ? (
                  <div className={chatEmptyStateClass}>
                    <p className="text-sm font-medium text-[var(--foreground)]">Consulta multi-repo</p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
                      Pregunta por archivos o flujos en cualquier repositorio del proyecto. El modelo usa el grafo
                      unificado.
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
                    placeholder="¿Qué quieres saber del proyecto?"
                    rows={3}
                    disabled={loading}
                    className={composerTextareaClass}
                    aria-label="Mensaje al chat del proyecto"
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
