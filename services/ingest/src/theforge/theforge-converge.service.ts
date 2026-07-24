/**
 * @fileoverview Post-sync hook: call The Forge brownfield converge after Ariadne reindex.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { decrypt } from '../credentials/crypto.util';
import type {
  TheForgeConvergeSyncKind,
  TheForgeConvergeTriggerMode,
  TheForgeConvergeTriggerResult,
} from './theforge-converge.types';
import type { TheForgeIntegrationEffective } from './theforge-integration.types';
import { TheForgeIntegrationService } from './theforge-integration.service';
import { normalizeForgeApiBase } from './forge-http.util';

const VALID_MODES = new Set<TheForgeConvergeTriggerMode>(['off', 'full', 'incremental', 'all']);

export function normalizeTheForgeConvergeTriggerMode(
  raw: string | null | undefined,
): TheForgeConvergeTriggerMode {
  const v = (raw ?? 'off').trim() as TheForgeConvergeTriggerMode;
  return VALID_MODES.has(v) ? v : 'off';
}

export function shouldTriggerTheForgeConverge(
  mode: TheForgeConvergeTriggerMode,
  syncKind: TheForgeConvergeSyncKind,
): boolean {
  if (mode === 'off') return false;
  if (mode === 'all') return true;
  return mode === syncKind;
}

@Injectable()
export class TheForgeConvergeService {
  private readonly logger = new Logger(TheForgeConvergeService.name);

  constructor(
    @InjectRepository(RepositoryEntity)
    private readonly repoRepo: Repository<RepositoryEntity>,
    private readonly integration: TheForgeIntegrationService,
  ) {}

  /**
   * Fire-and-forget safe wrapper: never throws; logs warnings on failure.
   */
  async triggerAfterSync(
    repositoryId: string,
    syncKind: TheForgeConvergeSyncKind,
  ): Promise<TheForgeConvergeTriggerResult> {
    try {
      return await this.triggerAfterSyncInner(repositoryId, syncKind);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`TheForge converge hook unexpected error for repo ${repositoryId}: ${msg}`);
      return { triggered: false, reason: 'unexpected_error' };
    }
  }

  private async triggerAfterSyncInner(
    repositoryId: string,
    syncKind: TheForgeConvergeSyncKind,
  ): Promise<TheForgeConvergeTriggerResult> {
    const repo = await this.repoRepo.findOne({
      where: { id: repositoryId },
      select: [
        'id',
        'theforgeProjectId',
        'theforgeStageId',
        'theforgeConvergePersist',
        'theforgeConvergeTriggerMode',
        'theforgeServiceTokenEncrypted',
      ],
    });
    if (!repo) return { triggered: false, reason: 'repo_not_found' };

    const theforgeProjectId = (repo.theforgeProjectId ?? '').trim();
    if (!theforgeProjectId) return { triggered: false, reason: 'no_theforge_project_id' };

    const mode = normalizeTheForgeConvergeTriggerMode(repo.theforgeConvergeTriggerMode);
    if (!shouldTriggerTheForgeConverge(mode, syncKind)) {
      return { triggered: false, reason: 'mode_skip', mode, theforgeProjectId };
    }

    const cfg = await this.integration.getEffective();
    const apiBase =
      cfg.transport === 'rest'
        ? cfg.apiUrl?.trim()
        : cfg.configuredUrl
          ? normalizeForgeApiBase(cfg.configuredUrl)
          : null;
    if (!apiBase) {
      this.logger.warn(
        `TheForge converge skipped for repo ${repositoryId}: URL API REST no configurada (modo MCP no soporta converge/trigger; usa …/api + JWT REST)`,
      );
      return { triggered: false, reason: 'no_theforge_api_url', mode, theforgeProjectId };
    }

    const token = this.resolveServiceToken(repo, cfg);
    if (!token) {
      this.logger.warn(
        `TheForge converge skipped for repo ${repositoryId}: no service JWT (Ajustes, THEFORGE_SERVICE_JWT o token por repo)`,
      );
      return { triggered: false, reason: 'no_service_token', mode, theforgeProjectId };
    }

    const stageId = (repo.theforgeStageId ?? '').trim();
    const url = new URL(`${apiBase}/projects/${encodeURIComponent(theforgeProjectId)}/converge/trigger`);
    if (stageId) url.searchParams.set('stageId', stageId);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ persist: repo.theforgeConvergePersist === true }),
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 800);
      this.logger.warn(
        `TheForge converge/trigger ${url.pathname} → HTTP ${res.status}: ${body}`,
      );
      return {
        triggered: true,
        ok: false,
        status: res.status,
        mode,
        theforgeProjectId,
      };
    }

    this.logger.log(
      `TheForge converge/trigger OK (repo ${repositoryId}, project ${theforgeProjectId}, sync ${syncKind})`,
    );
    return {
      triggered: true,
      ok: true,
      status: res.status,
      mode,
      theforgeProjectId,
    };
  }

  private resolveServiceToken(
    repo: RepositoryEntity,
    cfg: TheForgeIntegrationEffective,
  ): string | null {
    if (repo.theforgeServiceTokenEncrypted) {
      try {
        const decrypted = decrypt(repo.theforgeServiceTokenEncrypted).trim();
        if (decrypted) return decrypted;
      } catch {
        return null;
      }
    }
    return this.integration.resolveServiceToken(cfg);
  }
}
