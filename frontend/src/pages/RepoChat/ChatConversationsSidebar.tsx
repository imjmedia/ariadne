import { MessageSquarePlus, PanelLeft, Trash2 } from 'lucide-react';
import type { ChatConversation } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { chatNavBtnClass } from '../chat/chatShellClasses';

function formatConversationDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function conversationLabel(c: ChatConversation): string {
  return c.title?.trim() || 'Nueva conversación';
}

export function ChatConversationsSidebar(props: {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]',
        props.className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-3">
        <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
          Chats
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(chatNavBtnClass, 'h-8 gap-1.5 px-2 text-xs')}
          onClick={props.onCreate}
          disabled={props.loading}
        >
          <MessageSquarePlus className="size-3.5 shrink-0" aria-hidden />
          Nuevo
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {props.loading && props.conversations.length === 0 ? (
          <p className="px-2 py-4 text-xs text-[var(--foreground-muted)]">Cargando…</p>
        ) : props.conversations.length === 0 ? (
          <p className="px-2 py-4 text-xs text-[var(--foreground-muted)]">
            Sin conversaciones. Pulsa Nuevo para empezar.
          </p>
        ) : (
          <ul className="space-y-1">
            {props.conversations.map((c) => {
              const active = c.id === props.activeConversationId;
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => props.onSelect(c.id)}
                    className={cn(
                      'w-full rounded-xl px-3 py-2.5 pr-9 text-left transition-colors',
                      active
                        ? 'bg-[var(--secondary)] text-[var(--foreground)]'
                        : 'text-[var(--foreground-muted)] hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]',
                    )}
                  >
                    <span className="line-clamp-2 text-sm leading-snug">{conversationLabel(c)}</span>
                    <span className="mt-1 block text-[10px] opacity-70">
                      {formatConversationDate(c.updatedAt)}
                      {c.messageCount > 0 ? ` · ${c.messageCount} msg` : ''}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 size-7 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('¿Eliminar esta conversación?')) props.onDelete(c.id);
                    }}
                    title="Eliminar conversación"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    <span className="sr-only">Eliminar conversación</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

/** Botón móvil para abrir el panel de historial. */
export function ChatConversationsMobileToggle(props: { onOpen: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(chatNavBtnClass, 'size-10 shrink-0 md:hidden', props.className)}
      onClick={props.onOpen}
      title="Historial de chats"
    >
      <PanelLeft className="size-4" aria-hidden />
      <span className="sr-only">Historial de chats</span>
    </Button>
  );
}
