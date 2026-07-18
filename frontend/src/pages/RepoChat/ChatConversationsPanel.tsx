import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ChatConversation } from '@/types';
import { cn } from '@/lib/utils';
import { ChatConversationsSidebar } from './ChatConversationsSidebar';

export function ChatConversationsPanel(props: {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const handleSelect = (id: string) => {
    props.onSelect(id);
    props.onMobileOpenChange(false);
  };

  const sidebarProps = {
    conversations: props.conversations,
    activeConversationId: props.activeConversationId,
    loading: props.loading,
    onSelect: handleSelect,
    onCreate: props.onCreate,
    onDelete: props.onDelete,
  };

  return (
    <>
      <ChatConversationsSidebar {...sidebarProps} className="hidden md:flex" />

      <Dialog open={props.mobileOpen} onOpenChange={props.onMobileOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            'fixed inset-y-0 left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[min(100vw,16rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-y-0 border-l-0 p-0 sm:rounded-r-2xl sm:border-r',
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Historial de chats</DialogTitle>
            <DialogDescription>Conversaciones guardadas de este repositorio o proyecto.</DialogDescription>
          </DialogHeader>
          <ChatConversationsSidebar
            {...sidebarProps}
            onSelect={handleSelect}
            className="h-full w-full rounded-none border-0"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
