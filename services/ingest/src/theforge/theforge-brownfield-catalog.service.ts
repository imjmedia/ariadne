/**
 * Catálogo de proyectos brownfield (LEGACY) en The Forge para vincular desde Ariadne.
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { forgeIntegrationFetch, forgeErrorMessage, readForgeJsonBody } from './forge-http.util';
import {
  extractForgeProjectRows,
  isForgeAriadneIndexedProjectList,
  isForgeLegacyProject,
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

export interface ForgeBrownfieldListResult {
  projects: ForgeBrownfieldProjectOption[];
  hint?: string;
  diagnostics?: {
    pathsTried: string[];
    totalRowsSeen: number;
    sampleTypes: string[];
  };
}

/** Workshop projects only. Do not use GET /theforge/projects (Ariadne multi-root index). */
const LIST_PATHS = ['/projects', '/projects?projectType=LEGACY'] as const;

@Injectable()
export class TheForgeBrownfieldCatalogService {
  private readonly logger = new Logger(TheForgeBrownfieldCatalogService.name);

  constructor(private readonly integration: TheForgeIntegrationService) {}

  async listBrownfieldProjects(): Promise<ForgeBrownfieldListResult> {
    if (this.integration.isMockMode()) {
      return {
        projects: [
          {
            id: '00000000-0000-4000-8000-forge00000001',
            name: 'Proyecto brownfield (mock)',
            groupName: 'Workshop',
            projectType: 'LEGACY',
          },
        ],
      };
    }

    const cfg = await this.integration.getEffective();
    let lastError: { status: number; message: string } | null = null;
    const pathsTried: string[] = [];
    let totalRowsSeen = 0;
    const sampleTypes = new Set<string>();

    for (const path of LIST_PATHS) {
      pathsTried.push(path);
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

      totalRowsSeen = Math.max(totalRowsSeen, rows.length);
      for (const row of rows.slice(0, 8)) {
        const t = readForgeProjectType(row);
        sampleTypes.add(t || '(sin projectType)');
      }

      if (isLikelyAriadneProjectList(rows)) {
        throw new ServiceUnavailableException({
          code: 'FORGE_WRONG_API_URL',
          message:
            'THEFORGE_API_URL apunta a Ariadne (GET /projects devuelve repos), no a la API de The Forge. Configura la URL base de The Forge en Ajustes → The Forge.',
        });
      }

      if (isForgeAriadneIndexedProjectList(rows)) {
        this.logger.warn(
          `Forge GET ${path} → lista indexada Ariadne (roots[]), no proyectos Workshop; omitiendo`,
        );
        continue;
      }

      const legacy = rows
        .filter((row) => isForgeLegacyProject(row))
        .map((row) => ({
          id: readForgeProjectId(row),
          name: readForgeProjectName(row),
          groupName: readForgeGroupName(row),
          projectType: 'LEGACY' as const,
        }))
        .filter((row) => row.id.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

      if (legacy.length > 0) {
        return { projects: legacy };
      }

      this.logger.warn(
        `Forge GET ${path} → ${rows.length} proyectos Workshop pero ninguno LEGACY (tipos: ${[...sampleTypes].join(', ')})`,
      );
    }

    const diagnostics = {
      pathsTried,
      totalRowsSeen,
      sampleTypes: [...sampleTypes],
    };

    if (lastError) {
      throw new ServiceUnavailableException({
        code: 'FORGE_LIST_PROJECTS_FAILED',
        message: lastError.message,
        status: lastError.status,
        diagnostics,
      });
    }

    return {
      projects: [],
      hint:
        totalRowsSeen > 0
          ? `The Forge devolvió ${totalRowsSeen} proyecto(s) Workshop pero ninguno clasificado como LEGACY (projectType o stages[].isLegacy). Tipos vistos: ${[...sampleTypes].join(', ') || '—'}.`
          : 'The Forge respondió sin proyectos Workshop en GET /projects. Verifica THEFORGE_API_URL (API Workshop, no /theforge/projects de índice Ariadne) y permisos del JWT de servicio.',
      diagnostics,
    };
  }
}
