import { describe, it, expect } from 'vitest';
import {
  extractLastMermaidDiagram,
  synthesizeUserDescription,
} from './conversation-change-synthesizer';
import { slugifyStageKey } from './change-promotion-pack.types';

describe('conversation-change-synthesizer', () => {
  it('extractLastMermaidDiagram returns last mermaid block', () => {
    const messages = [
      { role: 'user' as const, content: 'ver ```mermaid\nerDiagram\n  A ||--o{ B : x\n```' },
      { role: 'assistant' as const, content: 'ok' },
      { role: 'user' as const, content: '```mermaid\nflowchart LR\n  X-->Y\n```' },
    ];
    expect(extractLastMermaidDiagram(messages)).toContain('flowchart LR');
  });

  it('synthesizeUserDescription uses title and user messages', () => {
    const desc = synthesizeUserDescription(
      'Reingeniería BD',
      [{ role: 'user', content: 'Quiero normalizar tablas de medios' }],
    );
    expect(desc).toContain('Reingeniería BD');
  });
});

describe('slugifyStageKey', () => {
  it('normalizes unicode and spaces', () => {
    expect(slugifyStageKey('Reingeniería BD v2')).toBe('REINGENIERIA_BD_V2');
  });
});
