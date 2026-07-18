import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { decrypt, encrypt } from '../credentials/crypto.util';
import { maskApiKeyHint } from '../llm-settings/llm-settings.util';
import { setActiveSystemConfig } from './active-system-config';
import { SystemSettingsEntity } from './entities/system-settings.entity';
import { buildSystemSettingsFromEnv } from './system-settings.defaults';
import type {
  SystemSettingsEffective,
  SystemSettingsMasked,
  UpdateSystemSettingsDto,
  SYSTEM_SETTINGS_SINGLETON_ID,
} from './system-settings.types';

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SystemSettingsService.name);
  private cachedEffective: SystemSettingsEffective | null = null;
  private cacheLoadedAt = 0;
  private static readonly CACHE_TTL_MS = 15_000;

  constructor(
    @InjectRepository(SystemSettingsEntity)
    private readonly repo: Repository<SystemSettingsEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.refreshActiveConfig();
      this.logger.log('System settings hydrated into active config');
    } catch (err) {
      this.logger.warn(
        `System settings init: ${err instanceof Error ? err.message : String(err)} — using env fallback`,
      );
      const envRuntime = buildSystemSettingsFromEnv();
      setActiveSystemConfig(envRuntime);
      this.cachedEffective = envRuntime;
      this.cacheLoadedAt = Date.now();
    }
  }

  async getMasked(): Promise<SystemSettingsMasked> {
    const runtime = await this.getEffective();
    const row = await this.findRow();
    return this.toMasked(runtime, row);
  }

  async getEffective(): Promise<SystemSettingsEffective> {
    const now = Date.now();
    if (
      this.cachedEffective &&
      now - this.cacheLoadedAt < SystemSettingsService.CACHE_TTL_MS
    ) {
      return this.cachedEffective;
    }
    return this.refreshActiveConfig();
  }

  async refreshActiveConfig(): Promise<SystemSettingsEffective> {
    const row = await this.findRow();
    const runtime = row ? this.buildFromRow(row) : buildSystemSettingsFromEnv();
    this.cachedEffective = runtime;
    this.cacheLoadedAt = Date.now();
    setActiveSystemConfig(runtime);
    return runtime;
  }

  invalidateCache(): void {
    this.cachedEffective = null;
    this.cacheLoadedAt = 0;
  }

  async update(dto: UpdateSystemSettingsDto, userId?: string): Promise<SystemSettingsMasked> {
    const existing = await this.findRow();
    const env = buildSystemSettingsFromEnv();
    const base = existing ? this.buildFromRow(existing) : env;

    let smtpPassEncrypted = existing?.smtpPassEncrypted ?? null;
    if (dto.smtpPass !== undefined) {
      const pass = dto.smtpPass?.trim() ?? '';
      smtpPassEncrypted = pass ? encrypt(pass) : null;
    }

    let githubTokenEncrypted = existing?.githubTokenEncrypted ?? null;
    if (dto.githubToken !== undefined) {
      const token = dto.githubToken?.trim() ?? '';
      githubTokenEncrypted = token ? encrypt(token) : null;
    }

    const row = this.repo.create({
      id: SYSTEM_SETTINGS_SINGLETON_ID,
      corsOrigin:
        dto.corsOrigin !== undefined
          ? dto.corsOrigin?.trim() || null
          : existing?.corsOrigin ?? base.corsOrigin,
      emailOtp:
        dto.emailOtp !== undefined
          ? dto.emailOtp?.trim().toLowerCase() || null
          : existing?.emailOtp ?? base.emailOtp,
      ssoUrl:
        dto.ssoUrl !== undefined ? dto.ssoUrl?.trim() || null : existing?.ssoUrl ?? base.ssoUrl,
      webAppHost:
        dto.webAppHost !== undefined
          ? dto.webAppHost?.trim() || null
          : existing?.webAppHost ?? base.webAppHost,
      smtpHost:
        dto.smtpHost !== undefined
          ? dto.smtpHost?.trim() || null
          : existing?.smtpHost ?? base.smtp.host,
      smtpPort:
        dto.smtpPort !== undefined && dto.smtpPort !== null
          ? dto.smtpPort
          : existing?.smtpPort ?? base.smtp.port,
      smtpUser:
        dto.smtpUser !== undefined
          ? dto.smtpUser?.trim() || null
          : existing?.smtpUser ?? base.smtp.user,
      smtpPassEncrypted,
      smtpFrom:
        dto.smtpFrom !== undefined
          ? dto.smtpFrom?.trim() || null
          : existing?.smtpFrom ?? base.smtp.from,
      falkorShardByProject:
        dto.falkorShardByProject ?? existing?.falkorShardByProject ?? base.falkor.shardByProject,
      falkorShardByDomain:
        dto.falkorShardByDomain ?? existing?.falkorShardByDomain ?? base.falkor.shardByDomain,
      falkorAutoDomainOverflow:
        dto.falkorAutoDomainOverflow ??
        existing?.falkorAutoDomainOverflow ??
        base.falkor.autoDomainOverflow,
      falkorGraphNodeSoftLimit:
        dto.falkorGraphNodeSoftLimit !== undefined && dto.falkorGraphNodeSoftLimit !== null
          ? dto.falkorGraphNodeSoftLimit
          : existing?.falkorGraphNodeSoftLimit ?? base.falkor.graphNodeSoftLimit,
      falkorDebugCypher:
        dto.falkorDebugCypher ?? existing?.falkorDebugCypher ?? base.falkor.debugCypher,
      metricsEnabled:
        dto.metricsEnabled ?? existing?.metricsEnabled ?? base.observability.metricsEnabled,
      chatTelemetryLog:
        dto.chatTelemetryLog ?? existing?.chatTelemetryLog ?? base.observability.chatTelemetryLog,
      chatTwoPhase: dto.chatTwoPhase ?? existing?.chatTwoPhase ?? base.chat.twoPhase,
      modificationPlanMaxFiles:
        dto.modificationPlanMaxFiles !== undefined && dto.modificationPlanMaxFiles !== null
          ? dto.modificationPlanMaxFiles
          : existing?.modificationPlanMaxFiles ?? base.chat.modificationPlanMaxFiles,
      ollamaBaseUrl:
        dto.ollamaBaseUrl !== undefined
          ? dto.ollamaBaseUrl?.trim() || null
          : existing?.ollamaBaseUrl ?? base.integrations.ollamaBaseUrl,
      ollamaEmbedModel:
        dto.ollamaEmbedModel !== undefined
          ? dto.ollamaEmbedModel?.trim() || null
          : existing?.ollamaEmbedModel ?? base.integrations.ollamaEmbedModel,
      githubTokenEncrypted,
      updatedBy: userId ?? null,
    });

    await this.repo.save(row);
    this.invalidateCache();
    await this.refreshActiveConfig();
    this.logger.log('System settings updated');
    return this.getMasked();
  }

  private buildFromRow(row: SystemSettingsEntity): SystemSettingsEffective {
    const env = buildSystemSettingsFromEnv();
    let smtpPass: string | null = null;
    if (row.smtpPassEncrypted) {
      try {
        smtpPass = decrypt(row.smtpPassEncrypted).trim() || null;
      } catch {
        smtpPass = null;
      }
    }
    let githubToken: string | null = null;
    if (row.githubTokenEncrypted) {
      try {
        githubToken = decrypt(row.githubTokenEncrypted).trim() || null;
      } catch {
        githubToken = null;
      }
    }

    return {
      corsOrigin: row.corsOrigin ?? env.corsOrigin,
      emailOtp: row.emailOtp ?? env.emailOtp,
      ssoUrl: row.ssoUrl ?? env.ssoUrl,
      webAppHost: row.webAppHost ?? env.webAppHost,
      smtp: {
        host: row.smtpHost ?? env.smtp.host,
        port: row.smtpPort ?? env.smtp.port,
        user: row.smtpUser ?? env.smtp.user,
        pass: smtpPass ?? env.smtp.pass,
        from: row.smtpFrom ?? env.smtp.from,
      },
      falkor: {
        shardByProject: row.falkorShardByProject ?? env.falkor.shardByProject,
        shardByDomain: row.falkorShardByDomain ?? env.falkor.shardByDomain,
        autoDomainOverflow: row.falkorAutoDomainOverflow ?? env.falkor.autoDomainOverflow,
        graphNodeSoftLimit: row.falkorGraphNodeSoftLimit ?? env.falkor.graphNodeSoftLimit,
        debugCypher: row.falkorDebugCypher ?? env.falkor.debugCypher,
      },
      observability: {
        metricsEnabled: row.metricsEnabled ?? env.observability.metricsEnabled,
        chatTelemetryLog: row.chatTelemetryLog ?? env.observability.chatTelemetryLog,
      },
      chat: {
        twoPhase: row.chatTwoPhase ?? env.chat.twoPhase,
        modificationPlanMaxFiles:
          row.modificationPlanMaxFiles ?? env.chat.modificationPlanMaxFiles,
      },
      integrations: {
        githubToken: githubToken ?? env.integrations.githubToken,
        ollamaBaseUrl: row.ollamaBaseUrl ?? env.integrations.ollamaBaseUrl,
        ollamaEmbedModel: row.ollamaEmbedModel ?? env.integrations.ollamaEmbedModel,
      },
    };
  }

  private toMasked(
    runtime: SystemSettingsEffective,
    row: SystemSettingsEntity | null,
  ): SystemSettingsMasked {
    const smtpPassHint =
      row?.smtpPassEncrypted != null
        ? maskApiKeyHint(decrypt(row.smtpPassEncrypted))
        : runtime.smtp.pass
          ? maskApiKeyHint(runtime.smtp.pass)
          : null;
    const githubHint =
      row?.githubTokenEncrypted != null
        ? maskApiKeyHint(decrypt(row.githubTokenEncrypted))
        : runtime.integrations.githubToken
          ? maskApiKeyHint(runtime.integrations.githubToken)
          : null;

    return {
      corsOrigin: runtime.corsOrigin,
      emailOtp: runtime.emailOtp,
      ssoUrl: runtime.ssoUrl,
      webAppHost: runtime.webAppHost,
      smtp: {
        host: runtime.smtp.host,
        port: runtime.smtp.port,
        user: runtime.smtp.user,
        from: runtime.smtp.from,
        hasPass: Boolean(runtime.smtp.pass),
        passHint: smtpPassHint,
      },
      falkor: runtime.falkor,
      observability: runtime.observability,
      chat: runtime.chat,
      integrations: {
        ollamaBaseUrl: runtime.integrations.ollamaBaseUrl,
        ollamaEmbedModel: runtime.integrations.ollamaEmbedModel,
        hasGithubToken: Boolean(runtime.integrations.githubToken),
        githubTokenHint: githubHint,
      },
    };
  }

  private async findRow(): Promise<SystemSettingsEntity | null> {
    return this.repo.findOne({ where: { id: SYSTEM_SETTINGS_SINGLETON_ID } });
  }
}
