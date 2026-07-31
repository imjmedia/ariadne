/**
 * Cliente HTTP al ingest: herramientas de retrieval (sin LLM) y listado de repos.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { ChatScope } from './chat-scope.util';
import type { AnalyzeMode, AnalyzeOrchestratorPrepDto, ModificationPlanResult } from './ingest-types';
import { fetchIngestJson } from './ingest-http.util';
export interface RetrieverToolHttpResult {
  toolResult: string;
  lastCypher?: string;
  collectedRows: unknown[];
}

@Injectable()
export class IngestChatClient {
  private readonly logger = new Logger(IngestChatClient.name);

  private ingestBase(): string {
    return (process.env.INGEST_URL ?? 'http://localhost:3002').replace(/\/$/, '');
  }

  async listRepositories(projectId: string): Promise<Array<{ id: string }>> {
    const url = `${this.ingestBase()}/repositories?projectId=${encodeURIComponent(projectId)}`;
    const res = await fetch(url);
    if (!res.ok) {
      this.logger.warn(`listRepositories ${res.status}: ${await res.text()}`);
      return [];
    }
    const data = (await res.json()) as Array<{ id: string }>;
    return Array.isArray(data) ? data : [];
  }

  async getRepository(id: string): Promise<{ id: string } | null> {
    const url = `${this.ingestBase()}/repositories/${encodeURIComponent(id)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as { id: string };
  }

  async gatherDeterministicRawEvidence(
    repositoryId: string,
    body: { message: string; scope?: ChatScope; projectScope?: boolean },
  ): Promise<{ gatheredContext: string; collectedResults: unknown[]; lastCypher: string }> {
    const url = `${this.ingestBase()}/internal/repositories/${encodeURIComponent(repositoryId)}/raw-evidence-deterministic`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ingest raw-evidence-deterministic ${res.status}: ${t}`);
    }
    return (await res.json()) as { gatheredContext: string; collectedResults: unknown[]; lastCypher: string };
  }

  async executeRetrieverTool(
    repositoryId: string,
    body: {
      projectScope?: boolean;
      scope?: ChatScope;
      tool: 'execute_cypher' | 'semantic_search' | 'get_graph_summary' | 'get_file_content';
      arguments: Record<string, unknown>;
      fallbackMessage?: string;
      evidenceVerbosity?: 'default' | 'full';
    },
  ): Promise<RetrieverToolHttpResult> {
    const url = `${this.ingestBase()}/internal/repositories/${encodeURIComponent(repositoryId)}/retriever-tool`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ingest retriever-tool ${res.status}: ${t}`);
    }
    return (await res.json()) as RetrieverToolHttpResult;
  }

  async fetchAnalyzePrepRepository(repositoryId: string, mode: AnalyzeMode): Promise<AnalyzeOrchestratorPrepDto> {
    const url = `${this.ingestBase()}/internal/repositories/${encodeURIComponent(repositoryId)}/analyze-prep`;
    return fetchIngestJson<AnalyzeOrchestratorPrepDto>(url, {
      body: { mode },
      timeoutMs: 180_000,
      label: 'analyze-prep',
    });
  }

  async fetchAnalyzePrepProject(projectId: string, mode: 'agents' | 'skill'): Promise<AnalyzeOrchestratorPrepDto> {
    const url = `${this.ingestBase()}/internal/projects/${encodeURIComponent(projectId)}/analyze-prep`;
    return fetchIngestJson<AnalyzeOrchestratorPrepDto>(url, {
      body: { mode },
      timeoutMs: 180_000,
      label: 'analyze-prep',
    });
  }

  /**
   * Solo archivos (Cypher + RAG). Usa el endpoint interno para no reentrar en
   * ingest `GET/POST .../modification-plan` → orchestrator → ingest (bucle + timeout 120s).
   */
  async fetchModificationPlanFilesRepository(
    repositoryId: string,
    userDescription: string,
    scope?: ChatScope,
  ): Promise<ModificationPlanResult['filesToModify']> {
    const url = `${this.ingestBase()}/internal/repositories/${encodeURIComponent(repositoryId)}/modification-plan-files`;
    const data = await fetchIngestJson<{ filesToModify?: ModificationPlanResult['filesToModify'] }>(url, {
      body: { userDescription, scope },
      timeoutMs: 120_000,
      label: 'modification-plan-files',
    });
    return Array.isArray(data.filesToModify) ? data.filesToModify : [];
  }

  /** Archivos del plan sin preguntas LLM (el orchestrator las genera aparte). */
  async fetchModificationPlanRepository(
    repositoryId: string,
    userDescription: string,
    scope?: ChatScope,
  ): Promise<ModificationPlanResult> {
    const filesToModify = await this.fetchModificationPlanFilesRepository(
      repositoryId,
      userDescription,
      scope,
    );
    return { filesToModify, questionsToRefine: [] };
  }

  async fetchMddEvidence(
    repositoryId: string,
    body: {
      message: string;
      gatheredContext: string;
      collectedResults: unknown[];
      projectScope: boolean;
      projectId?: string;
    },
  ): Promise<Record<string, unknown>> {
    const url = `${this.ingestBase()}/internal/repositories/${encodeURIComponent(repositoryId)}/mdd-evidence`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ingest mdd-evidence ${res.status}: ${t}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  async fetchModificationPlanFilesProject(
    projectId: string,
    userDescription: string,
    scope?: ChatScope,
  ): Promise<ModificationPlanResult['filesToModify']> {
    const url = `${this.ingestBase()}/internal/projects/${encodeURIComponent(projectId)}/modification-plan-files`;
    const data = await fetchIngestJson<{ filesToModify?: ModificationPlanResult['filesToModify'] }>(url, {
      body: { userDescription, scope },
      timeoutMs: 120_000,
      label: 'modification-plan-files-project',
    });
    return Array.isArray(data.filesToModify) ? data.filesToModify : [];
  }

  async fetchModificationPlanProject(
    projectId: string,
    userDescription: string,
    scope?: ChatScope,
  ): Promise<ModificationPlanResult> {
    const filesToModify = await this.fetchModificationPlanFilesProject(
      projectId,
      userDescription,
      scope,
    );
    return { filesToModify, questionsToRefine: [] };
  }

  async fetchIntegrationHandoffPlanRepository(
    repositoryId: string,
    userDescription: string,
    scope?: ChatScope,
  ): Promise<ModificationPlanResult> {
    const url = `${this.ingestBase()}/internal/repositories/${encodeURIComponent(repositoryId)}/integration-handoff-plan`;
    return fetchIngestJson<ModificationPlanResult>(url, {
      body: { userDescription, scope },
      timeoutMs: 180_000,
      label: 'integration-handoff-plan',
    });
  }

  async fetchIntegrationHandoffPlanProject(
    projectId: string,
    userDescription: string,
    scope?: ChatScope,
  ): Promise<ModificationPlanResult> {
    const url = `${this.ingestBase()}/internal/projects/${encodeURIComponent(projectId)}/integration-handoff-plan`;
    return fetchIngestJson<ModificationPlanResult>(url, {
      body: { userDescription, scope },
      timeoutMs: 180_000,
      label: 'integration-handoff-plan-project',
    });
  }

  async fetchUnusedApiEndpointsProject(
    projectId: string,
    scope?: ChatScope,
  ): Promise<{ answer: string; cypher?: string; result?: unknown[] }> {
    const url = `${this.ingestBase()}/internal/projects/${encodeURIComponent(projectId)}/unused-api-endpoints`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ingest unused-api-endpoints project ${res.status}: ${t}`);
    }
    return (await res.json()) as { answer: string; cypher?: string; result?: unknown[] };
  }

  async fetchUnusedApiEndpointsRepository(
    repositoryId: string,
    scope?: ChatScope,
  ): Promise<{ answer: string; cypher?: string; result?: unknown[] }> {
    const url = `${this.ingestBase()}/internal/repositories/${encodeURIComponent(repositoryId)}/unused-api-endpoints`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ingest unused-api-endpoints repo ${res.status}: ${t}`);
    }
    return (await res.json()) as { answer: string; cypher?: string; result?: unknown[] };
  }

  async fetchSchemaDatabaseProject(
    projectId: string,
    scope?: ChatScope,
  ): Promise<{ answer: string; cypher?: string; result?: unknown[] }> {
    const url = `${this.ingestBase()}/internal/projects/${encodeURIComponent(projectId)}/schema-database`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ingest schema-database project ${res.status}: ${t}`);
    }
    return (await res.json()) as { answer: string; cypher?: string; result?: unknown[] };
  }

  async fetchSchemaDatabaseRepository(
    repositoryId: string,
    scope?: ChatScope,
  ): Promise<{ answer: string; cypher?: string; result?: unknown[] }> {
    const url = `${this.ingestBase()}/internal/repositories/${encodeURIComponent(repositoryId)}/schema-database`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ingest schema-database repo ${res.status}: ${t}`);
    }
    return (await res.json()) as { answer: string; cypher?: string; result?: unknown[] };
  }
}
