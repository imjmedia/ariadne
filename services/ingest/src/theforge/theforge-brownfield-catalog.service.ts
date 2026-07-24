/**
 * Catálogo de proyectos brownfield (LEGACY) en The Forge para vincular desde Ariadne.
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { forgeIntegrationFetch, forgeErrorMessage, readForgeJsonBody } from './forge-http.util';
import { TheForgeIntegrationService } from './theforge-integration.service';

export interface ForgeBrownfieldProjectOption {
  id: string;
  name: string;
  groupName?: string | null;
  projectType: 'LEGACY';
}

@Injectable()
export class TheForgeBrownfieldCatalogService {
  private readonly logger = new Logger(TheForgeBrownfieldCatalogService.name);

  constructor(private readonly integration: TheForgeIntegrationService) {}

  async listBrownfieldProjects(): Promise<ForgeBrownfieldProjectOption[]> {
    if (this.integration.isMockMode()) {
      return [
        {
          id: '00000000-0000-4000-8000-forge00000001',
          name: 'Proyecto brownfield (mock)',
          groupName: 'Workshop',
          projectType: 'LEGACY',
        },
      ];
    }

    const cfg = await this.integration.getEffective();
    const res = await forgeIntegrationFetch(cfg, '/projects', { method: 'GET' });
    const body = await readForgeJsonBody(res);
    if (!res.ok) {
      this.logger.warn(`Forge GET /projects → HTTP ${res.status}`);
      throw new ServiceUnavailableException({
        code: 'FORGE_LIST_PROJECTS_FAILED',
        message: forgeErrorMessage(body, `No se pudieron listar proyectos Forge (${res.status})`),
      });
    }

    const rows = Array.isArray(body) ? body : [];
    return rows
      .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
      .filter((row) => String(row.projectType ?? '').toUpperCase() === 'LEGACY')
      .map((row) => ({
        id: String(row.id ?? '').trim(),
        name: String(row.name ?? 'Sin nombre').trim() || 'Sin nombre',
        groupName: typeof row.groupName === 'string' ? row.groupName : null,
        projectType: 'LEGACY' as const,
      }))
      .filter((row) => row.id.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}
