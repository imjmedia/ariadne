/**
 * Intents for multi-agent chat routing (orchestrator LangGraph).
 */
export const CHAT_INTENTS = [
  'codebase_qa',
  'schema_database',
  'reengineering',
  'unused_api_endpoints',
] as const;

export type ChatIntent = (typeof CHAT_INTENTS)[number];

export interface ChatIntentRouteResult {
  intent: ChatIntent;
  confidence: number;
  reasoning: string;
  focusTerms?: string[];
  source: 'llm_router' | 'keyword_fallback';
}
