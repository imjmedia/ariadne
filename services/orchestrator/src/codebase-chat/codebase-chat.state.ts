/**
 * Shared LangGraph state types for multi-agent codebase chat.
 */
import type { ChatIntent, ChatIntentRouteResult } from 'ariadne-common';
import type { ChatScope } from './chat-scope.util';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  cypher?: string;
  result?: unknown[];
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  scope?: ChatScope;
  twoPhase?: boolean;
  responseMode?: 'default' | 'evidence_first' | 'raw_evidence';
  deterministicRetriever?: boolean;
  threadId?: string;
  /** NEW-LEG handoff id (The Forge import) — forces integration_handoff agent. */
  integrationHandoffId?: string | null;
  chatMode?: 'integration_handoff' | string | null;
}

export interface ChatResponse {
  answer: string;
  cypher?: string;
  result?: unknown[];
  mddDocument?: Record<string, unknown>;
  intentRoute?: ChatIntentRouteResult;
}

export interface CodebaseChatState {
  repositoryId: string;
  projectId: string;
  message: string;
  historyContent?: string;
  projectScope: boolean;
  scope?: ChatScope;
  useTwoPhase: boolean;
  evidenceFirst: boolean;
  rawEvidence: boolean;
  deterministicRetriever: boolean;
  threadId?: string;
  lastCypher?: string;
  collectedResults: unknown[];
  gatheredContext: string;
  answer?: string;
  resultOut?: unknown[];
  chatIntent?: ChatIntent;
  intentRoute?: ChatIntentRouteResult;
  integrationHandoffId?: string;
  chatMode?: string;
}
