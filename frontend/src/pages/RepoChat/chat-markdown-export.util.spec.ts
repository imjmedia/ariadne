import { describe, it, expect } from 'vitest';
import { buildChatMarkdownExport } from './chat-markdown-export.util';

describe('buildChatMarkdownExport', () => {
  it('returns content as-is without cypher', () => {
    const md = '## Hola\n\n```mermaid\nerDiagram\n  A ||--o{ B : x\n```';
    expect(buildChatMarkdownExport(md)).toBe(md);
  });

  it('appends cypher fence when present', () => {
    const out = buildChatMarkdownExport('Respuesta', 'MATCH (n) RETURN n');
    expect(out).toContain('Respuesta');
    expect(out).toContain('```cypher');
    expect(out).toContain('MATCH (n) RETURN n');
  });
});
