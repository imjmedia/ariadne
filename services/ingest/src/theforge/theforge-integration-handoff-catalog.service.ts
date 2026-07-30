/**
 * List NEW Forge projects that expose integration handoffs (via MCP or REST).
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  extractForgeProjectRows,
  isLikelyAriadneProjectList,
  isForgeAriadneIndexedProjectList,
} from './forge-project-list.util';
import { forgeIntegrationFetch, readForgeJsonBody } from './forge-http.util';
import { forgeMcpCallToolJson } from './forge-mcp.util';
import type { ForgeIntegrationHandoffSourceOption } from './integration-handoff.types';
import {
  filterSentHandoffs,
  isForgeNewProject,
  readForgeIntegrationHandoff,
  readForgeProjectSummary,
} from './integration-handoff.util';
import { TheForgeIntegrationService } from './theforge-integration.service';
import type { TheForgeIntegrationEffective } from './theforge-integration.types';
import { readForgeGroupName } from './forge-project-list.util';

const HANDOFF_FETCH_CONCURRENCY = 4;

@Injectable()
export class TheForgeIntegrationHandoffCatalogService {
  private readonly logger = new Logger(TheForgeIntegrationHandoffCatalogService.name);

  constructor(private readonly integration: TheForgeIntegrationService) {}

  async listSourcesWithHandoffs(): Promise<ForgeIntegrationHandoffSourceOption[]> {
    if (!(await this.integration.isChatPromotionAvailable())) {
      throw new ServiceUnavailableException({
        code: 'FORGE_NOT_CONFIGURED',
        message: 'The Forge no está configurado.',
      });
    }

    if (this.integration.isMockMode()) {
      return [
        {
          forgeProjectId: '00000000-0000-4000-8000-forge00000002',
          forgeProjectName: 'Microservicio (mock)',
          groupName: 'Workshop',
          sentHandoffCount: 2,
        },
      ];
    }

    const cfg = await this.integration.getEffective();
    const newProjects =
      cfg.transport === 'mcp' && cfg.mcpUrl
        ? await this.listNewProjectsViaMcp(cfg)
        : await this.listNewProjectsViaRest(cfg);

    const results: ForgeIntegrationHandoffSourceOption[] = [];
    for (let i = 0; i < newProjects.length; i += HANDOFF_FETCH_CONCURRENCY) {
      const chunk = newProjects.slice(i, i + HANDOFF_FETCH_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (row) => {
          try {
            const detail = await this.fetchProjectDetail(cfg, readForgeProjectSummary(row).id);
            const handoff = readForgeIntegrationHandoff(detail);
            if (!handoff) return null;
            const sent = filterSentHandoffs(handoff);
            if (sent.length === 0) return null;
            const summary = readForgeProjectSummary(detail);
            return {
              forgeProjectId: summary.id,
              forgeProjectName: summary.name,
              groupName: readForgeGroupName(detail) ?? null,
              sentHandoffCount: sent.length,
              linkedLegacyProjectId: summary.linkedLegacyProjectId,
            } satisfies ForgeIntegrationHandoffSourceOption;
          } catch (err) {
            this.logger.warn(
              `Forge handoff probe failed for ${readForgeProjectSummary(row).id}: ${err instanceof Error ? err.message : String(err)}`,
            );
            return null;
          }
        }),
      );
      for (const row of chunkResults) {
        if (row) results.push(row);
      }
    }

    return results.sort((a, b) => a.forgeProjectName.localeCompare(b.forgeProjectName, 'es'));
  }

  async getProjectHandoffs(sourceForgeProjectId: string) {
    const cfg = await this.integration.getEffective();
    if (this.integration.isMockMode()) {
      return {
        forgeProjectId: sourceForgeProjectId,
        forgeProjectName: 'Microservicio (mock)',
        items: filterSentHandoffs({
          items: [
            {
              id: 'NEW-LEG-01',
              title: 'Integración mock',
              description: 'Handoff de prueba.',
              status: 'sent',
            },
          ],
        }),
      };
    }

    const detail = await this.fetchProjectDetail(cfg, sourceForgeProjectId.trim());
    const summary = readForgeProjectSummary(detail);
    const handoff = readForgeIntegrationHandoff(detail);
    if (!handoff) {
      throw new ServiceUnavailableException({
        code: 'FORGE_NO_HANDOFFS',
        message: 'El proyecto Forge seleccionado no tiene handoffs de integración.',
      });
    }
    const items = filterSentHandoffs(handoff);
    if (items.length === 0) {
      throw new ServiceUnavailableException({
        code: 'FORGE_NO_SENT_HANDOFFS',
        message: 'No hay handoffs NEW-LEG con status sent en este proyecto.',
      });
    }
    return {
      forgeProjectId: summary.id,
      forgeProjectName: summary.name,
      items,
    };
  }

  private async listNewProjectsViaMcp(cfg: TheForgeIntegrationEffective): Promise<Record<string, unknown>[]> {
    const body = await forgeMcpCallToolJson<unknown>(cfg, 'list_projects', {});
    const rows = extractForgeProjectRows(body);
    if (isLikelyAriadneProjectList(rows) || isForgeAriadneIndexedProjectList(rows)) {
      throw new ServiceUnavailableException({
        code: 'FORGE_WRONG_API_URL',
        message: 'list_projects no devolvió proyectos Workshop.',
      });
    }
    return rows.filter((row) => isForgeNewProject(row));
  }

  private async listNewProjectsViaRest(cfg: TheForgeIntegrationEffective): Promise<Record<string, unknown>[]> {
    const res = await forgeIntegrationFetch(cfg, '/projects', { method: 'GET' });
    const body = await readForgeJsonBody(res);
    if (!res.ok) {
      throw new ServiceUnavailableException({
        code: 'FORGE_LIST_PROJECTS_FAILED',
        message: `No se pudieron listar proyectos Forge (${res.status})`,
      });
    }
    const rows = extractForgeProjectRows(body);
    return rows.filter((row) => isForgeNewProject(row));
  }

  private async fetchProjectDetail(
    cfg: TheForgeIntegrationEffective,
    projectId: string,
  ): Promise<Record<string, unknown>> {
    if (cfg.transport === 'mcp' && cfg.mcpUrl) {
      const body = await forgeMcpCallToolJson<unknown>(cfg, 'get_project', { projectId });
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        return body as Record<string, unknown>;
      }
      throw new ServiceUnavailableException({
        code: 'FORGE_GET_PROJECT_FAILED',
        message: 'get_project no devolvió un proyecto válido.',
      });
    }

    const res = await forgeIntegrationFetch(cfg, `/projects/${encodeURIComponent(projectId)}`, {
      method: 'GET',
    });
    const body = await readForgeJsonBody(res);
    if (!res.ok || !body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ServiceUnavailableException({
        code: 'FORGE_GET_PROJECT_FAILED',
        message: `No se pudo leer el proyecto Forge (${res.status})`,
      });
    }
    return body as Record<string, unknown>;
  }
}
