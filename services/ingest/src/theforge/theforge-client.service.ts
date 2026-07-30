/**
 * @fileoverview HTTP client for The Forge promotion flow (resolve + create stage).
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type {
  CreateStageFromPackInput,
  CreateStageFromPackResult,
  ForgeProjectCandidate,
  ResolveForgeProjectInput,
  ResolveForgeProjectResult,
} from './change-promotion-pack.types';
import {
  ForgeResolveAmbiguousError,
  ForgeResolveNotFoundError,
} from './change-promotion-pack.types';
import { toForgeCreateStageApiBody } from './forge-create-stage.mapper';
import { forgeErrorMessage, forgeIntegrationFetch, readForgeJsonBody } from './forge-http.util';
import { forgeMcpCallToolJson } from './forge-mcp.util';
import {
  FORGE_CREATE_STAGE_TIMEOUT_MS,
  FORGE_REQUEST_TIMEOUT_MS,
} from './forge-timeout.constants';
import { TheForgeIntegrationService } from './theforge-integration.service';
import type { TheForgeIntegrationEffective } from './theforge-integration.types';

export abstract class TheForgeClient {
  abstract resolveProjectForAriadne(
    input: ResolveForgeProjectInput,
  ): Promise<ResolveForgeProjectResult>;

  abstract createStageFromChangePack(
    input: CreateStageFromPackInput,
  ): Promise<CreateStageFromPackResult>;
}

@Injectable()
export class TheForgeClientMock extends TheForgeClient {
  async resolveProjectForAriadne(
    input: ResolveForgeProjectInput,
  ): Promise<ResolveForgeProjectResult> {
    return {
      forgeProjectId: '00000000-0000-4000-8000-forge00000001',
      forgeProjectName: `Forge (mock) ${input.repoSlug ?? input.ariadneRepositoryId ?? 'project'}`,
      linkKind: 'primary',
      existingStages: [
        { id: '00000000-0000-4000-8000-stage00000001', name: 'Baseline', workflowStatus: 'ACTIVE' },
      ],
      warnings: ['THEFORGE_PROMOTE_MOCK=true'],
    };
  }

  async createStageFromChangePack(
    input: CreateStageFromPackInput,
  ): Promise<CreateStageFromPackResult> {
    const stageId = '00000000-0000-4000-8000-stage00000002';
    return {
      forgeProjectId: input.forgeProjectId,
      forgeStageId: stageId,
      stageKey: input.pack.change.stageKey,
      stageName: input.stageName ?? input.pack.change.title,
      stageUrl: `https://theforge.example/projects/${input.forgeProjectId}/stages/${stageId}`,
      importMode: input.stageId ? 'import' : 'create',
      legacyStart: { triggered: false, skipped: true, reason: 'mock' },
      ariadneWire: { linked: input.wireAriadne !== false, linkKind: 'primary' },
      recommendedNextTools: [
        'legacy_answer',
        'legacy_generate_mdd',
        'legacy_generate_deliverables',
        ...(input.pack.deliverablesRequested.includes('migration_tasks')
          ? ['validate_change_plan_via_ariadne']
          : []),
      ],
      deliverablesCreated: input.pack.deliverablesRequested,
    };
  }
}

@Injectable()
export class TheForgeClientHttp extends TheForgeClient {
  private readonly logger = new Logger(TheForgeClientHttp.name);

  constructor(private readonly integration: TheForgeIntegrationService) {
    super();
  }

  async resolveProjectForAriadne(
    input: ResolveForgeProjectInput,
  ): Promise<ResolveForgeProjectResult> {
    const cfg = await this.integration.getEffective();
    if (cfg.transport === 'mcp' && cfg.mcpUrl) {
      return this.resolveProjectViaMcp(cfg, input);
    }
    const res = await forgeIntegrationFetch(cfg, '/theforge/resolve-forge-project-for-ariadne', {
      method: 'POST',
      body: JSON.stringify(input),
    }, { timeoutMs: FORGE_REQUEST_TIMEOUT_MS });
    const body = await readForgeJsonBody(res);

    if (res.status === 404) {
      throw new ForgeResolveNotFoundError(forgeErrorMessage(body, 'No Forge project linked'));
    }
    if (res.status === 409) {
      const candidates = (body as { candidates?: ForgeProjectCandidate[] }).candidates ?? [];
      throw new ForgeResolveAmbiguousError(candidates);
    }
    if (!res.ok) {
      this.logger.warn(`resolve-forge-project-for-ariadne → HTTP ${res.status}`);
      throw new ServiceUnavailableException({
        code: 'FORGE_RESOLVE_FAILED',
        message: forgeErrorMessage(body, `Forge resolve failed (${res.status})`),
        status: res.status,
      });
    }

    const data = body as ResolveForgeProjectResult;
    if (!data.forgeProjectId) {
      throw new ServiceUnavailableException({
        code: 'FORGE_RESOLVE_INVALID',
        message: 'Forge resolve response missing forgeProjectId',
      });
    }
    return data;
  }

  async createStageFromChangePack(
    input: CreateStageFromPackInput,
  ): Promise<CreateStageFromPackResult> {
    try {
      const cfg = await this.integration.getEffective();
      if (cfg.transport === 'mcp' && cfg.mcpUrl) {
        return this.createStageViaMcp(cfg, input);
      }
      const payload = toForgeCreateStageApiBody(input);
      const res = await forgeIntegrationFetch(cfg, '/theforge/create-stage-from-ariadne-change-pack', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, { timeoutMs: FORGE_CREATE_STAGE_TIMEOUT_MS });
      const body = await readForgeJsonBody(res);

      if (!res.ok) {
        this.logger.warn(`create-stage-from-ariadne-change-pack → HTTP ${res.status}`);
        throw new ServiceUnavailableException({
          code: 'FORGE_CREATE_STAGE_FAILED',
          message: forgeErrorMessage(body, `Forge create stage failed (${res.status})`),
          status: res.status,
        });
      }

      return this.parseCreateStageResponse(body, input, cfg.apiUrl ?? cfg.mcpUrl ?? '');
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new ServiceUnavailableException({
          code: 'FORGE_CREATE_STAGE_TIMEOUT',
          message:
            'The Forge tardó demasiado en crear la etapa (timeout). Revisa logs de Forge o reintenta en unos minutos.',
        });
      }
      throw err;
    }
  }

  private async resolveProjectViaMcp(
    cfg: TheForgeIntegrationEffective,
    input: ResolveForgeProjectInput,
  ): Promise<ResolveForgeProjectResult> {
    const body = await forgeMcpCallToolJson<Record<string, unknown>>(
      cfg,
      'resolve_forge_project_for_ariadne',
      { ...input },
    );

    const status = typeof body.status === 'number' ? body.status : undefined;
    if (status === 404) {
      throw new ForgeResolveNotFoundError(
        typeof body.message === 'string' ? body.message : 'No Forge project linked',
      );
    }
    if (status === 409) {
      const candidates = (body.candidates as ForgeProjectCandidate[] | undefined) ?? [];
      throw new ForgeResolveAmbiguousError(candidates);
    }

    const data = body as unknown as ResolveForgeProjectResult;
    if (!data.forgeProjectId) {
      throw new ServiceUnavailableException({
        code: 'FORGE_RESOLVE_INVALID',
        message: 'Forge MCP resolve response missing forgeProjectId',
      });
    }
    return data;
  }

  private async createStageViaMcp(
    cfg: TheForgeIntegrationEffective,
    input: CreateStageFromPackInput,
  ): Promise<CreateStageFromPackResult> {
    const payload = toForgeCreateStageApiBody(input);
    const body = await forgeMcpCallToolJson<unknown>(
      cfg,
      'create_stage_from_ariadne_change_pack',
      payload as unknown as Record<string, unknown>,
      { timeoutMs: FORGE_CREATE_STAGE_TIMEOUT_MS },
    );
    return this.parseCreateStageResponse(body, input, cfg.mcpUrl ?? '');
  }

  private parseCreateStageResponse(
    body: unknown,
    input: CreateStageFromPackInput,
    apiBase: string,
  ): CreateStageFromPackResult {
    const data = (body ?? {}) as Record<string, unknown>;
    const stageId =
      (typeof data.stageId === 'string' && data.stageId) ||
      (typeof data.forgeStageId === 'string' && data.forgeStageId) ||
      '';
    if (!stageId) {
      throw new ServiceUnavailableException({
        code: 'FORGE_CREATE_STAGE_INVALID',
        message: 'Forge create stage response missing stageId',
      });
    }

    const forgeProjectId =
      (typeof data.forgeProjectId === 'string' && data.forgeProjectId) || input.forgeProjectId;
    const stageName =
      (typeof data.stageName === 'string' && data.stageName) ||
      input.stageName ||
      input.pack.change.title;
    const stageKey =
      (typeof data.stageKey === 'string' && data.stageKey) || input.pack.change.stageKey;

    let stageUrl = typeof data.stageUrl === 'string' ? data.stageUrl : undefined;
    if (!stageUrl && apiBase) {
      stageUrl = `${apiBase.replace(/\/$/, '')}/projects/${encodeURIComponent(forgeProjectId)}/stages/${encodeURIComponent(stageId)}`;
    }

    return {
      forgeProjectId,
      forgeStageId: stageId,
      stageKey,
      stageName,
      stageUrl,
      importMode:
        (data.importMode as CreateStageFromPackResult['importMode']) ??
        (input.stageId ? 'import' : 'create'),
      legacyStart: data.legacyStart as CreateStageFromPackResult['legacyStart'],
      ariadneWire: data.ariadneWire as CreateStageFromPackResult['ariadneWire'],
      recommendedNextTools: Array.isArray(data.recommendedNextTools)
        ? (data.recommendedNextTools as string[])
        : undefined,
      deliverablesCreated: Array.isArray(data.deliverablesCreated)
        ? (data.deliverablesCreated as string[])
        : undefined,
    };
  }
}

export { ForgeResolveAmbiguousError, ForgeResolveNotFoundError };
