/**
 * Proveedor LLM del orchestrator — delega en llm-unified (LLM_* + legacy).
 */
import {
  hasLlmCredentials,
  resolveLlmModel,
  resolveLlmProvider,
  resolveLlmRouterModel,
  resolveLlmWorkerModel,
  type UnifiedLlmProvider,
} from './llm-unified';

export type OrchestratorLlmProvider = UnifiedLlmProvider;

export function resolveOrchestratorLlmProvider(): OrchestratorLlmProvider {
  return resolveLlmProvider();
}

export function orchestratorLlmModel(): string {
  return resolveLlmModel(resolveLlmProvider());
}

export function orchestratorLlmRouterModel(): string {
  return resolveLlmRouterModel();
}

export function orchestratorLlmWorkerModel(): string {
  return resolveLlmWorkerModel();
}

export function hasOrchestratorLlmConfigured(): boolean {
  return hasLlmCredentials(resolveLlmProvider());
}
