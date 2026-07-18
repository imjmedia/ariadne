/**
 * @fileoverview Configuración global opcional de The Forge (Ajustes admin).
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { decrypt, encrypt } from '../credentials/crypto.util';
import { maskApiKeyHint } from '../llm-settings/llm-settings.util';
import {
  THEFORGE_INTEGRATION_SINGLETON_ID,
  TheForgeIntegrationEntity,
} from './entities/theforge-integration.entity';
import type {
  TheForgeIntegrationEffective,
  TheForgeIntegrationMasked,
  TheForgeIntegrationStatus,
  UpdateTheForgeIntegrationDto,
} from './theforge-integration.types';

@Injectable()
export class TheForgeIntegrationService {
  private readonly logger = new Logger(TheForgeIntegrationService.name);
  private cachedEffective: TheForgeIntegrationEffective | null = null;
  private cacheLoadedAt = 0;
  private static readonly CACHE_TTL_MS = 15_000;

  constructor(
    @InjectRepository(TheForgeIntegrationEntity)
    private readonly repo: Repository<TheForgeIntegrationEntity>,
  ) {}

  isMockMode(): boolean {
    return process.env.THEFORGE_PROMOTE_MOCK === 'true';
  }

  async getStatus(): Promise<TheForgeIntegrationStatus> {
    if (this.isMockMode()) {
      return { chatPromotionAvailable: true, mock: true, enabled: true };
    }
    const effective = await this.getEffective();
    const chatPromotionAvailable = effective.enabled && Boolean(effective.apiUrl?.trim());
    return {
      chatPromotionAvailable,
      mock: false,
      enabled: effective.enabled,
    };
  }

  async isChatPromotionAvailable(): Promise<boolean> {
    return (await this.getStatus()).chatPromotionAvailable;
  }

  async getMasked(): Promise<TheForgeIntegrationMasked> {
    const row = await this.findRow();
    const envApiUrl = this.envApiUrl();
    return {
      enabled: row?.enabled === true,
      apiUrl: row?.apiUrl ?? envApiUrl ?? null,
      hasServiceToken: Boolean(row?.serviceTokenEncrypted) || Boolean(this.envServiceToken()),
      serviceTokenHint: row?.serviceTokenEncrypted
        ? maskApiKeyHint(decrypt(row.serviceTokenEncrypted))
        : this.envServiceToken()
          ? maskApiKeyHint(this.envServiceToken()!)
          : null,
      envApiUrlConfigured: Boolean(envApiUrl),
    };
  }

  async getEffective(): Promise<TheForgeIntegrationEffective> {
    const now = Date.now();
    if (this.cachedEffective && now - this.cacheLoadedAt < TheForgeIntegrationService.CACHE_TTL_MS) {
      return this.cachedEffective;
    }
    const row = await this.findRow();
    const effective = this.buildEffective(row);
    this.cachedEffective = effective;
    this.cacheLoadedAt = now;
    return effective;
  }

  async update(dto: UpdateTheForgeIntegrationDto, userId?: string): Promise<TheForgeIntegrationMasked> {
    const existing = await this.findRow();
    const enabled = dto.enabled ?? existing?.enabled ?? false;
    let apiUrl = dto.apiUrl !== undefined ? dto.apiUrl?.trim() || null : existing?.apiUrl ?? null;
    if (!apiUrl && enabled) {
      apiUrl = this.envApiUrl();
    }
    if (enabled && !apiUrl) {
      throw new ForbiddenException(
        'Indica la URL de la API de The Forge o define THEFORGE_API_URL en el entorno.',
      );
    }

    let serviceTokenEncrypted = existing?.serviceTokenEncrypted ?? null;
    if (dto.serviceToken !== undefined) {
      const token = dto.serviceToken?.trim() ?? '';
      serviceTokenEncrypted = token ? encrypt(token) : null;
    }

    const row = this.repo.create({
      id: THEFORGE_INTEGRATION_SINGLETON_ID,
      enabled,
      apiUrl,
      serviceTokenEncrypted,
      updatedBy: userId ?? null,
    });
    await this.repo.save(row);
    this.cachedEffective = null;
    this.logger.log(`The Forge integration updated (enabled=${enabled})`);
    return this.getMasked();
  }

  resolveServiceToken(effective: TheForgeIntegrationEffective): string | null {
    if (effective.serviceToken?.trim()) return effective.serviceToken.trim();
    return this.envServiceToken();
  }

  private buildEffective(row: TheForgeIntegrationEntity | null): TheForgeIntegrationEffective {
    const enabled = row?.enabled === true;
    const apiUrl = (row?.apiUrl ?? this.envApiUrl() ?? '').trim() || null;
    let serviceToken: string | null = null;
    if (row?.serviceTokenEncrypted) {
      try {
        serviceToken = decrypt(row.serviceTokenEncrypted).trim() || null;
      } catch {
        serviceToken = null;
      }
    }
    if (!serviceToken) {
      serviceToken = this.envServiceToken();
    }
    return {
      enabled,
      apiUrl: enabled ? apiUrl : null,
      serviceToken: enabled ? serviceToken : null,
    };
  }

  private envApiUrl(): string | null {
    const v = (process.env.THEFORGE_API_URL ?? '').trim().replace(/\/$/, '');
    return v || null;
  }

  private envServiceToken(): string | null {
    const v = (process.env.THEFORGE_SERVICE_JWT ?? '').trim();
    return v || null;
  }

  private async findRow(): Promise<TheForgeIntegrationEntity | null> {
    return this.repo.findOne({ where: { id: THEFORGE_INTEGRATION_SINGLETON_ID } });
  }
}
