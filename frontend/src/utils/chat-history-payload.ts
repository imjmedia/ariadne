/**
 * Chat history compaction and safe request payloads (avoids HTTP 413 on multi-turn chat).
 */
import type { IngestChatHistoryEntry } from '../types';

/** Messages kept in React state (older ones dropped). */
export const CHAT_MAX_MESSAGES_IN_MEMORY = 24;
/** Latest assistant replies kept at full length in memory. */
export const CHAT_FULL_ASSISTANT_REPLIES = 2;
/** Older assistant bubbles truncated in memory. */
export const CHAT_MAX_STORED_ASSISTANT_CHARS = 4_000;
/** User messages truncated in memory when very long. */
export const CHAT_MAX_STORED_USER_CHARS = 2_000;
/** Messages sent as `history` on the next POST. */
export const CHAT_MAX_HISTORY_FOR_REQUEST = 6;
/** Per-field caps in the outbound `history` body. */
export const CHAT_MAX_HISTORY_CONTENT_CHARS = 8_000;
export const CHAT_MAX_HISTORY_CYPHER_CHARS = 2_000;

export type ChatMessageForHistory = {
  role: 'user' | 'assistant';
  content: string;
  cypher?: string;
  result?: unknown;
};

export type ChatMemoryCompactionResult = {
  messages: ChatMessageForHistory[];
  compacted: boolean;
  droppedCount: number;
};

function truncate(text: string, max: number, label = 'truncado para el historial del chat'): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[${label}]`;
}

/**
 * Shrinks in-memory conversation: drops oldest messages, strips `result`, truncates old assistant/user text.
 * Latest {@link CHAT_FULL_ASSISTANT_REPLIES} assistant answers stay full for display.
 */
export function compactChatMessagesInMemory(messages: ChatMessageForHistory[]): ChatMemoryCompactionResult {
  let compacted = false;
  let droppedCount = 0;
  let list = [...messages];

  if (list.length > CHAT_MAX_MESSAGES_IN_MEMORY) {
    droppedCount = list.length - CHAT_MAX_MESSAGES_IN_MEMORY;
    list = list.slice(-CHAT_MAX_MESSAGES_IN_MEMORY);
    compacted = true;
  }

  const assistantIndices = list
    .map((m, i) => (m.role === 'assistant' ? i : -1))
    .filter((i) => i >= 0);
  const keepFullAssistants = new Set(assistantIndices.slice(-CHAT_FULL_ASSISTANT_REPLIES));

  list = list.map((m, i) => {
    const next: ChatMessageForHistory = { role: m.role, content: m.content };
    if (m.cypher?.trim()) next.cypher = m.cypher;

    if (m.role === 'assistant' && !keepFullAssistants.has(i)) {
      if (next.content.length > CHAT_MAX_STORED_ASSISTANT_CHARS) {
        compacted = true;
        next.content = truncate(next.content, CHAT_MAX_STORED_ASSISTANT_CHARS, 'respuesta anterior compactada');
      }
      if (next.cypher && next.cypher.length > CHAT_MAX_HISTORY_CYPHER_CHARS) {
        compacted = true;
        next.cypher = truncate(next.cypher, CHAT_MAX_HISTORY_CYPHER_CHARS);
      }
    }

    if (m.role === 'user' && next.content.length > CHAT_MAX_STORED_USER_CHARS) {
      compacted = true;
      next.content = truncate(next.content, CHAT_MAX_STORED_USER_CHARS, 'mensaje anterior compactado');
    }

    if (m.result !== undefined) compacted = true;

    return next;
  });

  return { messages: list, compacted, droppedCount };
}

/** Rough JSON body size for the next chat POST (history + message). */
export function estimateChatRequestBytes(
  messages: ChatMessageForHistory[],
  nextMessage: string,
): number {
  const history = buildChatHistoryForRequest(messages);
  const payload = { message: nextMessage, history };
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return 0;
  }
}

/** Omits `result`; truncates `content` and `cypher` for the outbound request body. */
export function buildChatHistoryForRequest(
  messages: ChatMessageForHistory[],
  maxMessages = CHAT_MAX_HISTORY_FOR_REQUEST,
): IngestChatHistoryEntry[] {
  return messages.slice(-maxMessages).map((m) => {
    const entry: IngestChatHistoryEntry = {
      role: m.role,
      content: truncate(m.content, CHAT_MAX_HISTORY_CONTENT_CHARS),
    };
    if (m.cypher?.trim()) {
      entry.cypher = truncate(m.cypher, CHAT_MAX_HISTORY_CYPHER_CHARS);
    }
    return entry;
  });
}

export function formatMemoryCompactionNote(result: ChatMemoryCompactionResult): string | null {
  if (!result.compacted) return null;
  const parts: string[] = [];
  if (result.droppedCount > 0) {
    parts.push(`${result.droppedCount} mensaje(s) antiguo(s) fuera de memoria`);
  }
  parts.push('respuestas largas compactadas para evitar error 413');
  return parts.join(' · ');
}
