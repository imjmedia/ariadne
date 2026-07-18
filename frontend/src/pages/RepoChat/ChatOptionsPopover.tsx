import type { ReactNode } from 'react';
import type { ChatPipelineMode } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AnalyzeScopeFields } from '@/components/analyze/AnalyzeScopeFields';
import { ChatPipelineModeSelect } from './ChatPipelineModeSelect';

export function ChatOptionsPopover(props: {
  trigger: ReactNode;
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
  modeSelectId?: string;
  extraContent?: ReactNode;
}) {
  const modeId = props.modeSelectId ?? 'chat-mode-popover';
  return (
    <Popover>
      <PopoverTrigger asChild>{props.trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[min(calc(100vw-2rem),22rem)] space-y-4 p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Opciones del chat</p>
          <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
            Modo de respuesta y alcance opcional del grafo.
          </p>
        </div>
        {props.extraContent}
        <ChatPipelineModeSelect
          value={props.chatPipelineMode}
          onChange={props.onChatPipelineModeChange}
          id={modeId}
          density="compact"
        />
        <AnalyzeScopeFields
          includePrefixesText={props.includePrefixesText}
          onIncludePrefixesText={props.onIncludePrefixesText}
          excludeGlobsText={props.excludeGlobsText}
          onExcludeGlobsText={props.onExcludeGlobsText}
          crossPackageDuplicates={props.crossPackageDuplicates}
          onCrossPackageDuplicates={props.onCrossPackageDuplicates}
          showCrossPackage
        />
        {props.memoryNote ? (
          <p className="text-[11px] leading-relaxed text-[var(--foreground-muted)]">
            <span className="font-medium text-[var(--foreground)]">Memoria:</span> {props.memoryNote}
          </p>
        ) : props.messageCount > 0 ? (
          <p className="text-[11px] text-[var(--foreground-muted)]">
            {props.messageCount} mensaje(s) en esta conversación
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
