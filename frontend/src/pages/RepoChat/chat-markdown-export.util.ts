/**
 * Build clipboard markdown for a chat assistant answer (preserves mermaid fences).
 */
export function buildChatMarkdownExport(content: string, cypher?: string): string {
  const body = (content ?? '').trimEnd();
  const query = (cypher ?? '').trim();
  if (!query) return body;
  return `${body}\n\n\`\`\`cypher\n${query}\n\`\`\``;
}
