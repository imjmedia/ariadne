/**
 * Catálogo de proyectos brownfield (LEGACY) en The Forge para vincular desde Ariadne.
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { forgeIntegrationFetch, forgeErrorMessage, readForgeJsonBody } from './forge-http.util';
import {
  extractForgeProjectRows,
  isLikelyAriadneProjectList,
  readForgeGroupName,
  readForgeProjectId,
  readForgeProjectName,
  readForgeProjectType,
} from './forge-project-list.util';
import { TheForgeIntegrationService } from './theforge-integration.service';

export interface ForgeBrownfieldProjectOption {
  id: string;
  name: string;
  groupName?: string | null;
  projectType: 'LEGACY';
}

const LIST_PATHS = ['/projects', '/theforge/projects'] as const;

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
    let lastError: { status: number; message: string } | null = null;

    for (const path of LIST_PATHS) {
      const res = await forgeIntegrationFetch(cfg, path, { method: 'GET' });
      const body = await readForgeJsonBody(res);
      if (!res.ok) {
        lastError = {
          status: res.status,
          message: forgeErrorMessage(body, `No se pudieron listar proyectos Forge (${res.status})`),
        };
        this.logger.warn(`Forge GET ${path} → HTTP ${res.status}`);
        continue;
      }

      const rows = extractForgeProjectRows(body);
      if (rows.length === 0) {
        this.logger.warn(`Forge GET ${path} → 200 pero sin filas parseables`);
        continue;
      }

      if (isLikelyAriadneProjectList(rows)) {
        throw new ServiceUnavailableException({
          code: 'FORGE_WRONG_API_URL',
          message:
            'THEFORGE_API_URL apunta a Ariadne (GET /projects devuelve repos), no a la API de The Forge. Configura la URL base de The Forge en Ajustes → The Forge.',
        });
      }

      const legacy = rows
        .filter((row) => readForgeProjectType(row) === 'LEGACY')
        .map((row) => ({
          id: readForgeProjectId(row),
          name: readForgeProjectName(row),
          groupName: readForgeGroupName(row),
          projectType: 'LEGACY' as const,
        }))
        .filter((row) => row.id.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

      if (legacy.length > 0) {
        return legacy;
      }

      this.logger.warn(
        `Forge GET ${path} → ${rows.length} proyectos pero ninguno LEGACY (revisa projectType en The Forge)`,
      );
    }

    if (lastError) {
      throw new ServiceUnavailableException({
        code: 'FORGE_LIST_PROJECTS_FAILED',
        message: lastError.message,
        status: lastError.status,
      });
    }

    return [];
  }
}
