import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, MessageSquarePlus, Settings2 } from 'lucide-react';
import type { ChatPipelineMode } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { chatNavBtnClass } from '../chat/chatShellClasses';
import { ChatOptionsPopover } from './ChatOptionsPopover';
import { ChatForgePromoteButton } from './ChatForgePromoteDialog';

const PIPELINE_BADGE: Record<ChatPipelineMode, string> = {
  default: 'Chat',
  evidence_first: 'MDD',
  raw_evidence_fast: 'Evidencia',
};

export function ChatPageHeader(props: {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  titleMono?: boolean;
  chatPipelineMode: ChatPipelineMode;
  onChatPipelineModeChange: (mode: ChatPipelineMode) => void;
  includePrefixesText: string;
  onIncludePrefixesText: (v: string) => void;
  excludeGlobsText: string;
  onExcludeGlobsText: (v: string) => void;
  crossPackageDuplicates: boolean;
  onCrossPackageDuplicates: (v: boolean) => void;
  memoryNote: string | null;
  messageCount: number;
  onNewConversation: () => void;
  newConversationDisabled?: boolean;
  onOpenAnalysis: () => void;
  analysisPending: boolean;
  activeConversationId?: string | null;
  forgePromoteDisabled?: boolean;
  forgeDefaultStageName?: string;
  forgePromotionAvailable?: boolean;
  headerLeadingExtra?: ReactNode;
  optionsExtra?: ReactNode;
  extraBadges?: ReactNode;
  modeSelectId?: string;
}) {
  const scopeActive =
    props.includePrefixesText.trim().length > 0 || props.excludeGlobsText.trim().length > 0;

  return (
    <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2 sm:items-center">
        <Button variant="outline" size="icon" className={cn(chatNavBtnClass, 'size-10 shrink-0')} asChild>
          <Link to={props.backHref} title={props.backLabel}>
            <ArrowLeft className="size-4" aria-hidden />
            <span className="sr-only">{props.backLabel}</span>
          </Link>
        </Button>
        {props.headerLeadingExtra}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
            {props.eyebrow}
          </p>
          <h1
            className={cn(
              'truncate text-base font-semibold text-[var(--foreground)] sm:text-lg',
              props.titleMono ? 'font-mono' : 'line-clamp-2 sm:line-clamp-none',
            )}
          >
            {props.title}
          </h1>
          {props.subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{props.subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Badge variant="outline" className="hidden rounded-lg px-2 py-0.5 text-[10px] font-medium sm:inline-flex">
          {PIPELINE_BADGE[props.chatPipelineMode]}
        </Badge>
        {scopeActive ? (
          <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[10px]">
            Alcance activo
          </Badge>
        ) : null}
        {props.extraBadges}

        <ChatOptionsPopover
          chatPipelineMode={props.chatPipelineMode}
          onChatPipelineModeChange={props.onChatPipelineModeChange}
          includePrefixesText={props.includePrefixesText}
          onIncludePrefixesText={props.onIncludePrefixesText}
          excludeGlobsText={props.excludeGlobsText}
          onExcludeGlobsText={props.onExcludeGlobsText}
          crossPackageDuplicates={props.crossPackageDuplicates}
          onCrossPackageDuplicates={props.onCrossPackageDuplicates}
          memoryNote={props.memoryNote}
          messageCount={props.messageCount}
          modeSelectId={props.modeSelectId}
          extraContent={props.optionsExtra}
          trigger={
            <Button type="button" variant="outline" size="sm" className={cn(chatNavBtnClass, 'gap-2')}>
              <Settings2 className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Opciones</span>
            </Button>
          }
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(chatNavBtnClass, 'relative gap-2')}
          onClick={props.onOpenAnalysis}
        >
          <BarChart3 className="size-4 shrink-0" aria-hidden />
          Análisis
          {props.analysisPending ? (
            <span
              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--primary)] ring-2 ring-[var(--background)]"
              aria-hidden
            />
          ) : null}
        </Button>

        {props.forgePromotionAvailable ? (
          <ChatForgePromoteButton
            conversationId={props.activeConversationId ?? null}
            disabled={props.forgePromoteDisabled}
            defaultStageName={props.forgeDefaultStageName}
          />
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(chatNavBtnClass, 'size-10 shrink-0')}
          onClick={props.onNewConversation}
          disabled={props.newConversationDisabled}
          title="Nueva conversación"
        >
          <MessageSquarePlus className="size-4" aria-hidden />
          <span className="sr-only">Nueva conversación</span>
        </Button>
      </div>
    </header>
  );
}
