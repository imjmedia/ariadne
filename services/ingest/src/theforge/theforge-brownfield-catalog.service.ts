/**
 * Catálogo de proyectos brownfield (LEGACY) en The Forge para vincular desde Ariadne.
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  collectForgeApiBaseCandidates,
  forgeErrorMessage,
  forgeHtmlApiUrlError,
  forgeIntegrationFetch,
  normalizeForgeApiBase,
  readForgeResponseBody,
} from './forge-http.util';
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
    apiBasesTried: string[];
    totalRowsSeen: number;
    sampleTypes: string[];
    htmlResponses: number;
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
    const configuredUrl = cfg.apiUrl?.trim() ?? '';
    const apiBases = collectForgeApiBaseCandidates(configuredUrl);
    let lastError: { status: number; message: string } | null = null;
    const pathsTried: string[] = [];
    const apiBasesTried: string[] = [];
    let totalRowsSeen = 0;
    let htmlResponses = 0;
    const sampleTypes = new Set<string>();

    for (const apiBase of apiBases) {
      apiBasesTried.push(apiBase);
      for (const path of LIST_PATHS) {
        pathsTried.push(`${apiBase}${path}`);
        const res = await forgeIntegrationFetch(cfg, path, { method: 'GET' }, { apiBase });
        const { body, isHtml } = await readForgeResponseBody(res);

        if (isHtml) {
          htmlResponses += 1;
          this.logger.warn(`Forge GET ${apiBase}${path} → HTML (¿frontend o /mcp?)`);
          continue;
        }

        if (!res.ok) {
          lastError = {
            status: res.status,
            message: forgeErrorMessage(body, `No se pudieron listar proyectos Forge (${res.status})`),
          };
          this.logger.warn(`Forge GET ${apiBase}${path} → HTTP ${res.status}`);
          continue;
        }

        const rows = extractForgeProjectRows(body);
        if (rows.length === 0) {
          this.logger.warn(`Forge GET ${apiBase}${path} → 200 pero sin filas parseables`);
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
            `Forge GET ${apiBase}${path} → lista indexada Ariadne (roots[]), no proyectos Workshop; omitiendo`,
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
          if (apiBase !== configuredUrl.replace(/\/$/, '')) {
            this.logger.log(
              `Forge brownfield list OK via alternate base ${apiBase} (configured: ${configuredUrl})`,
            );
          }
          return { projects: legacy };
        }

        this.logger.warn(
          `Forge GET ${apiBase}${path} → ${rows.length} proyectos Workshop pero ninguno LEGACY (tipos: ${[...sampleTypes].join(', ')})`,
        );
      }
    }

    const diagnostics = {
      pathsTried,
      apiBasesTried,
      totalRowsSeen,
      sampleTypes: [...sampleTypes],
      htmlResponses,
    };

    if (htmlResponses > 0 && totalRowsSeen === 0 && !lastError) {
      throw forgeHtmlApiUrlError(configuredUrl);
    }

    if (lastError) {
      const isMethodNotAllowed =
        lastError.status === 405 || /method not allowed/i.test(lastError.message);
      if (isMethodNotAllowed) {
        const configured = cfg.apiUrl?.trim() ?? '';
        throw new ServiceUnavailableException({
          code: 'FORGE_WRONG_API_URL',
          message:
            'THEFORGE_API_URL apunta al endpoint MCP (/mcp), que no acepta GET /projects. Usa la base REST de The Forge (p. ej. …/api), no la URL del MCP de Cursor.',
          configuredApiUrl: configured,
          suggestedApiUrl: normalizeForgeApiBase(configured),
          diagnostics,
        });
      }
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
          : htmlResponses > 0
            ? 'THEFORGE_API_URL respondió HTML en lugar de JSON. Usa la base de la API REST (p. ej. https://tu-dominio/api), no /mcp ni la URL del frontend.'
            : 'The Forge respondió sin proyectos Workshop en GET /projects. Verifica THEFORGE_API_URL y permisos del JWT de servicio.',
      diagnostics,
    };
  }
}
