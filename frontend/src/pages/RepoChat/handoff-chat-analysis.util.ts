/**
 * Handoff import seeds a user message; the chat pipeline must be invoked separately.
 */
import type { ChatConversation } from '@/types';
import type { ChatMessage } from './ChatMessageThread';

export function conversationAwaitingHandoffAnalysis(
  conversation: Pick<ChatConversation, 'integrationHandoffId'> | null | undefined,
  messages: ChatMessage[],
): boolean {
  if (!conversation?.integrationHandoffId) return false;
  if (messages.some((m) => m.role === 'assistant')) return false;
  return messages.some((m) => m.role === 'user' && m.content.trim());
}

export function countBatchPendingHandoffAnalysis(
  conversations: ChatConversation[],
  batchId: string,
): number {
  return conversations.filter(
    (c) => c.integrationBatchId === batchId && c.integrationHandoffId && c.messageCount === 1,
  ).length;
}

export function extractLastUserPrompt(
  messages: ChatMessage[],
): { prior: ChatMessage[]; userMessage: string } | null {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return null;
  const userMessage = messages[lastUserIdx].content.trim();
  if (!userMessage) return null;
  return { prior: messages.slice(0, lastUserIdx), userMessage };
}

export function mapConversationMessages(
  rows: Array<{ role: 'user' | 'assistant'; content: string; cypher?: string | null }>,
): ChatMessage[] {
  return rows.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.cypher ? { cypher: m.cypher } : {}),
  }));
}
