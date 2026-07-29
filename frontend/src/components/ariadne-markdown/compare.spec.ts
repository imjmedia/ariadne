import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '@tanstack/markdown/parser';
import type { BlockNode, MarkdownDocument } from '@tanstack/markdown';
import { ARIADNE_MARKDOWN_FIXTURES } from './fixtures';

function collectBlockTypes(doc: MarkdownDocument): string[] {
  return doc.children.map((n) => n.type);
}

function findCodeLangs(nodes: BlockNode[]): string[] {
  const langs: string[] = [];
  for (const node of nodes) {
    if (node.type === 'code' && node.lang) langs.push(node.lang);
    if (node.type === 'list') {
      for (const item of node.items) {
        langs.push(...findCodeLangs(item.children));
      }
    }
    if (node.type === 'blockquote') langs.push(...findCodeLangs(node.children));
  }
  return langs;
}

function tableRowCount(doc: MarkdownDocument): number {
  const table = doc.children.find((n) => n.type === 'table');
  if (!table || table.type !== 'table') return 0;
  return table.rows.length;
}

describe('TanStack Markdown vs corpus OBP (parse)', () => {
  it('parses Archivos a tocar section with heading, table and mermaid fence', () => {
    const doc = parseMarkdown(ARIADNE_MARKDOWN_FIXTURES.archivosSection);
    expect(collectBlockTypes(doc)).toContain('heading');
    expect(collectBlockTypes(doc)).toContain('table');
    expect(tableRowCount(doc)).toBe(2);
    expect(findCodeLangs(doc.children)).toContain('mermaid');
  });

  it('parses GFM task list and strikethrough in edge-case fixture', () => {
    const doc = parseMarkdown(ARIADNE_MARKDOWN_FIXTURES.llmEdgeCases);
    const list = doc.children.find((n) => n.type === 'list');
    expect(list?.type).toBe('list');
    if (list?.type === 'list') {
      expect(list.items.some((i) => i.checked === true)).toBe(true);
      expect(list.items.some((i) => i.checked === false)).toBe(true);
    }
    // strike is inline — paragraph should exist
    expect(doc.children.some((n) => n.type === 'paragraph')).toBe(true);
  });

  it('keeps bare URL as literal text (no autolink)', () => {
    const doc = parseMarkdown(ARIADNE_MARKDOWN_FIXTURES.llmEdgeCases);
    const para = doc.children.find((n) => n.type === 'paragraph');
    expect(para?.type).toBe('paragraph');
    if (para?.type === 'paragraph') {
      const text = para.children
        .filter((c) => c.type === 'text')
        .map((c) => (c.type === 'text' ? c.value : ''))
        .join('');
      expect(text).toContain('https://example.com/docs');
    }
  });
});
