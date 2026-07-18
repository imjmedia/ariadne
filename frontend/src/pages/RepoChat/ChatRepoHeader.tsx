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
  canClearConversation: boolean;
  onOpenAnalysis: () => void;
  analysisPending: boolean;
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
      canClearConversation={props.canClearConversation}
      onOpenAnalysis={props.onOpenAnalysis}
      analysisPending={props.analysisPending}
      modeSelectId="repo-chat-mode-popover"
    />
  );
}
