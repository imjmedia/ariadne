/**
 * Toolbar: nueva conversación + aviso de compactación de memoria del chat.
 */
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ChatConversationToolbar({
  messageCount,
  memoryNote,
  onNewConversation,
  loading,
  className,
}: {
  messageCount: number;
  memoryNote: string | null;
  onNewConversation: () => void;
  loading: boolean;
  className?: string;
}) {
  const canClear = messageCount > 0 && !loading;

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0 flex-1">
        {memoryNote ? (
          <p className="text-[11px] leading-relaxed text-[var(--foreground-muted)]">
            <span className="font-medium text-[var(--foreground)]">Memoria compactada:</span> {memoryNote}
          </p>
        ) : messageCount > 0 ? (
          <p className="text-[11px] text-[var(--foreground-muted)]">
            {messageCount} mensaje(s) en esta conversación
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 gap-2 rounded-xl touch-manipulation"
        onClick={onNewConversation}
        disabled={!canClear}
        title="Limpia el historial del chat (no afecta análisis ni alcance)"
      >
        <MessageSquarePlus className="size-4 shrink-0" aria-hidden />
        Nueva conversación
      </Button>
    </div>
  );
}
