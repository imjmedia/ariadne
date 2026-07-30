/**
 * @fileoverview Persistencia de conversaciones de chat por usuario (repo o proyecto).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api';
import type { ChatConversation } from '@/types';
import type { ChatMessage } from './ChatMessageThread';

export type ChatPersistenceScope =
  | { kind: 'repository'; id: string }
  | { kind: 'project'; id: string };

function activeStorageKey(scope: ChatPersistenceScope): string {
  return `ariadne:chat:active:${scope.kind}:${scope.id}`;
}

function toUiMessages(
  rows: Awaited<ReturnType<typeof api.getConversationMessages>>,
): ChatMessage[] {
  return rows.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.cypher ? { cypher: m.cypher } : {}),
  }));
}

export function useChatPersistence(scope: ChatPersistenceScope | null) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const initRef = useRef(false);

  const listConversations = useCallback(async () => {
    if (!scope) return [];
    if (scope.kind === 'repository') return api.listRepoConversations(scope.id);
    return api.listProjectConversations(scope.id);
  }, [scope]);

  const createConversation = useCallback(async () => {
    if (!scope) throw new Error('Scope no definido');
    const created =
      scope.kind === 'repository'
        ? await api.createRepoConversation(scope.id)
        : await api.createProjectConversation(scope.id);
    setConversations((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    setActiveConversationId(created.id);
    sessionStorage.setItem(activeStorageKey(scope), created.id);
    setMessages([]);
    setPersistenceError(null);
    return created;
  }, [scope]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const rows = await api.getConversationMessages(conversationId);
      setMessages(toUiMessages(rows));
      setPersistenceError(null);
    } catch (e) {
      setPersistenceError(e instanceof Error ? e.message : String(e));
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const selectConversation = useCallback(
    async (conversationId: string) => {
      if (!scope || conversationId === activeConversationId) return;
      setActiveConversationId(conversationId);
      sessionStorage.setItem(activeStorageKey(scope), conversationId);
      await loadMessages(conversationId);
    },
    [scope, activeConversationId, loadMessages],
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      await api.deleteConversation(conversationId);
      const remaining = conversations.filter((c) => c.id !== conversationId);
      setConversations(remaining);

      if (activeConversationId !== conversationId) return;

      if (remaining.length > 0) {
        const next = remaining[0];
        setActiveConversationId(next.id);
        if (scope) sessionStorage.setItem(activeStorageKey(scope), next.id);
        await loadMessages(next.id);
      } else {
        setActiveConversationId(null);
        if (scope) sessionStorage.removeItem(activeStorageKey(scope));
        setMessages([]);
        const created = await createConversation();
        setActiveConversationId(created.id);
      }
    },
    [conversations, activeConversationId, scope, loadMessages, createConversation],
  );

  const ensureActiveConversation = useCallback(async (): Promise<string> => {
    if (activeConversationId) return activeConversationId;
    const created = await createConversation();
    return created.id;
  }, [activeConversationId, createConversation]);

  const persistMessage = useCallback(
    async (conversationId: string, message: ChatMessage) => {
      await api.appendConversationMessage(conversationId, {
        role: message.role,
        content: message.content,
        cypher: message.cypher ?? null,
      });
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx < 0) return prev;
        const row = prev[idx];
        const updated: ChatConversation = {
          ...row,
          updatedAt: new Date().toISOString(),
          messageCount: row.messageCount + 1,
          title:
            row.title ||
            (message.role === 'user' ? message.content.replace(/\s+/g, ' ').trim().slice(0, 72) : row.title),
        };
        const rest = prev.filter((c) => c.id !== conversationId);
        return [updated, ...rest];
      });
    },
    [],
  );

  const startNewConversation = useCallback(async () => {
    await createConversation();
  }, [createConversation]);

  useEffect(() => {
    if (!scope) return;
    initRef.current = false;
    setConversationsLoading(true);
    setPersistenceError(null);
    setActiveConversationId(null);
    setMessages([]);

    void (async () => {
      try {
        const list = await listConversations();
        setConversations(list);

        const stored = sessionStorage.getItem(activeStorageKey(scope));
        const initialId =
          (stored && list.some((c) => c.id === stored) ? stored : null) ??
          (list[0]?.id ?? null);

        if (initialId) {
          setActiveConversationId(initialId);
          sessionStorage.setItem(activeStorageKey(scope), initialId);
          await loadMessages(initialId);
        } else {
          const created = await createConversation();
          setActiveConversationId(created.id);
        }
      } catch (e) {
        setPersistenceError(e instanceof Error ? e.message : String(e));
      } finally {
        setConversationsLoading(false);
        initRef.current = true;
      }
    })();
  }, [scope?.kind, scope?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- remount per scope

  const reloadConversations = useCallback(async () => {
    if (!scope) return [];
    setConversationsLoading(true);
    try {
      const list = await listConversations();
      setConversations(list);
      setPersistenceError(null);
      return list;
    } catch (e) {
      setPersistenceError(e instanceof Error ? e.message : String(e));
      return [];
    } finally {
      setConversationsLoading(false);
    }
  }, [scope, listConversations]);

  return {
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
    reloadConversations,
  };
}
