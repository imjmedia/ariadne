import { describe, expect, it } from 'vitest';
import {
  conversationNeedsHandoffAnalysis,
  countBatchNeedingHandoffAnalysis,
  hasSuccessfulHandoffAssistant,
  isHandoffAnalysisFailureMessage,
  stripHandoffFailureAssistants,
} from './handoff-chat-analysis.util';

describe('handoff-chat-analysis.util', () => {
  it('detects persisted pipeline errors', () => {
    expect(isHandoffAnalysisFailureMessage('Error: 500: Internal server error')).toBe(true);
    expect(isHandoffAnalysisFailureMessage('Análisis completado')).toBe(false);
  });

  it('treats failed assistant as still needing analysis', () => {
    const messages = [
      { role: 'user' as const, content: 'Handoff seed' },
      { role: 'assistant' as const, content: 'Error: 500: Internal server error' },
    ];
    expect(hasSuccessfulHandoffAssistant(messages)).toBe(false);
    expect(
      conversationNeedsHandoffAnalysis({ integrationHandoffId: 'NEW-LEG-01', messageCount: 2 }, messages),
    ).toBe(true);
    expect(stripHandoffFailureAssistants(messages)).toEqual([
      { role: 'user', content: 'Handoff seed' },
    ]);
  });

  it('counts batch chats with seed or failed error', () => {
    const conversations = [
      {
        id: 'a',
        integrationBatchId: 'batch',
        integrationHandoffId: 'NEW-LEG-01',
        messageCount: 2,
        title: null,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'b',
        integrationBatchId: 'batch',
        integrationHandoffId: 'NEW-LEG-02',
        messageCount: 1,
        title: null,
        createdAt: '',
        updatedAt: '',
      },
    ];
    expect(countBatchNeedingHandoffAnalysis(conversations, 'batch', null, [])).toBe(2);
  });
});
