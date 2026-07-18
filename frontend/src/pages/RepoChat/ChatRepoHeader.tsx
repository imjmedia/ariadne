import type { ReactNode } from 'react';
import type { Repository, ChatPipelineMode } from '@/types';
import { ChatPageHeader } from './ChatPageHeader';

export function ChatRepoHeader(props: {
  repo: Repository;
  repoId: string;
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
  onToggleViewMode: () => void;
  chatViewMode: 'chat' | 'analysis';
  analysisPending: boolean;
  activeConversationId?: string | null;
  forgePromoteDisabled?: boolean;
  forgeDefaultStageName?: string;
  forgePromotionAvailable?: boolean;
  headerLeadingExtra?: ReactNode;
}) {
  return (
    <ChatPageHeader
      backHref={`/repos/${props.repoId}`}
      backLabel="Volver al repositorio"
      eyebrow="Chat"
      title={`${props.repo.projectKey}/${props.repo.repoSlug}`}
      titleMono
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
      onNewConversation={props.onNewConversation}
      newConversationDisabled={props.newConversationDisabled}
      onToggleViewMode={props.onToggleViewMode}
      chatViewMode={props.chatViewMode}
      analysisPending={props.analysisPending}
      activeConversationId={props.activeConversationId}
      forgePromoteDisabled={props.forgePromoteDisabled}
      forgeDefaultStageName={props.forgeDefaultStageName}
      forgePromotionAvailable={props.forgePromotionAvailable}
      headerLeadingExtra={props.headerLeadingExtra}
      modeSelectId="repo-chat-mode-popover"
    />
  );
}
