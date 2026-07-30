/**
 * Handoff import seeds a user message; the chat pipeline must be invoked separately.
 */
import type { ChatConversation } from '@/types';
import type { ChatMessage } from './ChatMessageThread';

export function isHandoffAnalysisFailureMessage(content: string): boolean {
  return /^Error:\s/i.test(content.trim());
}

export function hasSuccessfulHandoffAssistant(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) => m.role === 'assistant' && !isHandoffAnalysisFailureMessage(m.content),
  );
}

export function stripHandoffFailureAssistants(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(
    (m) => !(m.role === 'assistant' && isHandoffAnalysisFailureMessage(m.content)),
  );
}

export function normalizeHandoffThreadMessages(messages: ChatMessage[]): ChatMessage[] {
  if (!hasSuccessfulHandoffAssistant(messages)) return messages;
  return stripHandoffFailureAssistants(messages);
}

/** Handoff still needs (or can retry) LLM analysis. */
export function conversationNeedsHandoffAnalysis(
  conversation: Pick<ChatConversation, 'integrationHandoffId' | 'messageCount'> | null | undefined,
  messages: ChatMessage[],
): boolean {
  if (!conversation?.integrationHandoffId) return false;
  if (!messages.some((m) => m.role === 'user' && m.content.trim())) return false;
  return !hasSuccessfulHandoffAssistant(messages);
}

/** @deprecated use conversationNeedsHandoffAnalysis */
export const conversationAwaitingHandoffAnalysis = conversationNeedsHandoffAnalysis;

export function countBatchNeedingHandoffAnalysis(
  conversations: ChatConversation[],
  batchId: string,
  activeConversationId: string | null,
  activeMessages: ChatMessage[],
): number {
  return conversations.filter((c) => {
    if (c.integrationBatchId !== batchId || !c.integrationHandoffId) return false;
    if (c.id === activeConversationId) {
      return conversationNeedsHandoffAnalysis(c, activeMessages);
    }
    if (c.messageCount === 1) return true;
    // user + failed assistant (persisted error bubble)
    if (c.messageCount === 2) return true;
    return false;
  }).length;
}

/** @deprecated use countBatchNeedingHandoffAnalysis */
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

export function handoffAnalysisNeedsRetry(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) => m.role === 'assistant' && isHandoffAnalysisFailureMessage(m.content),
  );
}
