/**
 * Extrae título, ERD Mermaid y notas de migración desde mensajes de chat persistidos.
 */
export interface ConversationMessageSlice {
  role: 'user' | 'assistant';
  content: string;
}

const MERMAID_BLOCK = /```mermaid\s*([\s\S]*?)```/gi;

export function extractLastMermaidDiagram(messages: ConversationMessageSlice[]): string | null {
  let last: string | null = null;
  for (const m of messages) {
    MERMAID_BLOCK.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MERMAID_BLOCK.exec(m.content)) !== null) {
      const body = match[1]?.trim();
      if (body) last = body;
    }
  }
  return last;
}

export function extractUserMigrationNotes(
  messages: ConversationMessageSlice[],
  maxChars = 8000,
): string | null {
  const parts = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const joined = parts.join('\n\n---\n\n');
  return joined.length > maxChars ? `${joined.slice(0, maxChars - 1)}…` : joined;
}

export function synthesizeUserDescription(
  conversationTitle: string | null,
  messages: ConversationMessageSlice[],
  maxChars = 2000,
): string {
  const title = conversationTitle?.trim();
  const firstUser = messages.find((m) => m.role === 'user')?.content.trim();
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content.trim();
  const chunks = [title, firstUser, lastUser].filter(Boolean) as string[];
  const unique = [...new Set(chunks)];
  const text = unique.join('\n\n').replace(/\s+/g, ' ').trim();
  if (!text) return 'Change promoted from Ariadne chat conversation';
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

export function extractDecisionBullets(messages: ConversationMessageSlice[]): string[] {
  const decisions: string[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    const lines = m.content.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (/^[-*]\s+/.test(t) && t.length > 10 && t.length < 240) {
        decisions.push(t.replace(/^[-*]\s+/, '').trim());
      }
    }
  }
  return [...new Set(decisions)].slice(0, 12);
}

export function buildChangeTitle(
  stageName: string | undefined,
  conversationTitle: string | null,
  userDescription: string,
): string {
  const fromInput = stageName?.trim();
  if (fromInput) return fromInput;
  if (conversationTitle?.trim()) return conversationTitle.trim();
  const firstLine = userDescription.split('\n')[0]?.trim();
  return firstLine?.slice(0, 120) || 'Cambio desde Ariadne';
}
