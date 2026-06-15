import { describe, expect, it } from 'vitest';
import {
  CHAT_MAX_MESSAGES_IN_MEMORY,
  compactChatMessagesInMemory,
  buildChatHistoryForRequest,
} from './chat-history-payload';

describe('compactChatMessagesInMemory', () => {
  it('drops oldest messages beyond cap', () => {
    const many = Array.from({ length: CHAT_MAX_MESSAGES_IN_MEMORY + 5 }, (_, i) => ({
      role: 'user' as const,
      content: `msg ${i}`,
    }));
    const r = compactChatMessagesInMemory(many);
    expect(r.messages.length).toBe(CHAT_MAX_MESSAGES_IN_MEMORY);
    expect(r.droppedCount).toBe(5);
    expect(r.compacted).toBe(true);
    expect(r.messages[0].content).toBe('msg 5');
  });

  it('strips result and truncates old assistant content', () => {
    const long = 'x'.repeat(10_000);
    const r = compactChatMessagesInMemory([
      { role: 'assistant', content: long, result: [{ path: 'huge' }] },
      { role: 'assistant', content: 'mid' },
      { role: 'assistant', content: 'recent' },
      { role: 'user', content: 'follow-up' },
    ]);
    expect(r.messages[0].content.length).toBeLessThan(long.length);
    expect(r.messages[2].content).toBe('recent');
    expect(r.compacted).toBe(true);
  });
});

describe('buildChatHistoryForRequest', () => {
  it('never includes result in history entries', () => {
    const history = buildChatHistoryForRequest([
      { role: 'assistant', content: 'ok', result: [1, 2, 3] },
    ]);
    expect(history[0]).toEqual({ role: 'assistant', content: 'ok' });
  });
});
