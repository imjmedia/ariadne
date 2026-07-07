import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { encrypt, decrypt } from '../credentials/crypto.util';
import { setActiveLlmConfig } from './active-llm-config';
import {
  LLM_SETTINGS_SINGLETON_ID,
  LlmSettingsEntity,
} from './entities/llm-settings.entity';
import {
  buildCloudflareBaseUrl,
  getCatalogEntry,
  getCatalogList,
  isProviderId,
  resolveCloudflareAccountId,
  resolveEmbeddingDimension,
  type ProviderCatalogEntry,
  type ProviderId,
} from './llm-catalog';
import type {
  LlmRuntimeConfig,
  LlmSettingsMasked,
  LlmTestConnectionResult,
  UpdateLlmSettingsDto,
} from './llm-settings.types';
import { maskApiKeyHint } from './llm-settings.util';
import {
  LLM_DEFAULT_BASE,
  LLM_DEFAULT_CHAT_MODEL,
  LLM_DEFAULT_EMBEDDING_MODEL,
} from '../llm/llm-config';

@Injectable()
export class LlmSettingsService implements OnModuleInit {
  private readonly logger = new Logger(LlmSettingsService.name);
  private cachedEffective: LlmRuntimeConfig | null = null;
  private cacheLoadedAt = 0;
  private static readonly CACHE_TTL_MS = 30_000;

  constructor(
    @InjectRepository(LlmSettingsEntity)
    private readonly repo: Repository<LlmSettingsEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.refreshActiveConfig();
      this.logger.log('LLM settings hydrated into active config');
    } catch (err) {
      this.logger.warn(
        `LLM settings init: ${err instanceof Error ? err.message : String(err)} — using env fallback`,
      );
      const envRuntime = this.buildFromEnv();
      setActiveLlmConfig(envRuntime);
      this.cachedEffective = envRuntime;
      this.cacheLoadedAt = Date.now();
    }
  }

  getCatalog(): ProviderCatalogEntry[] {
    return getCatalogList();
  }

  async getMasked(): Promise<LlmSettingsMasked> {
    const runtime = await this.getEffective();
    return this.toMasked(runtime, await this.findRow());
  }

  async getEffective(): Promise<LlmRuntimeConfig> {
    const now = Date.now();
    if (this.cachedEffective && now - this.cacheLoadedAt < LlmSettingsService.CACHE_TTL_MS) {
      return this.cachedEffective;
    }
    return this.refreshActiveConfig();
  }

  async refreshActiveConfig(): Promise<LlmRuntimeConfig> {
    const row = await this.findRow();
    const runtime = row ? this.buildFromRow(row) : this.buildFromEnv();
    this.cachedEffective = runtime;
    this.cacheLoadedAt = Date.now();
    setActiveLlmConfig(runtime);
    return runtime;
  }

  async update(dto: UpdateLlmSettingsDto, userId?: string): Promise<LlmSettingsMasked> {
    const existing = await this.findRow();
    const provider = dto.provider ?? existing?.provider ?? this.envProvider();
    if (!isProviderId(provider)) {
      throw new ForbiddenException(`Proveedor no soportado: ${provider}`);
    }
    const catalog = getCatalogEntry(provider)!;

    let apiKeyEncrypted = existing?.apiKeyEncrypted ?? null;
    if (dto.apiKey !== undefined) {
      const trimmed = dto.apiKey.trim();
      if (trimmed) {
        apiKeyEncrypted = encrypt(trimmed);
      }
    }

    const extras = dto.extras !== undefined ? dto.extras : (existing?.extras ?? {});
    const accountId =
      typeof extras.accountId === 'string' ? extras.accountId.trim() : '';
    let baseUrl =
      dto.baseUrl?.trim() ||
      existing?.baseUrl?.trim() ||
      catalog.defaultBaseUrl;
    if (provider === 'cloudflare' && accountId) {
      baseUrl = buildCloudflareBaseUrl(accountId);
    }

    const chatModel =
      dto.chatModel?.trim() ||
      existing?.chatModel?.trim() ||
      catalog.defaultChatModel;
    const orchestratorChatModel =
      dto.orchestratorChatModel !== undefined
        ? dto.orchestratorChatModel?.trim() || null
        : (existing?.orchestratorChatModel ?? null);
    const temperature =
      dto.temperature !== undefined
        ? dto.temperature
        : (existing?.temperature ?? this.envTemperature());
    const embeddingProvider =
      dto.embeddingProvider !== undefined
        ? dto.embeddingProvider
        : (existing?.embeddingProvider as ProviderId | null) ??
          (catalog.supportsEmbeddings ? provider : null);
    const embeddingModel =
      dto.embeddingModel !== undefined
        ? dto.embeddingModel
        : (existing?.embeddingModel ??
          catalog.defaultEmbeddingModel);
    const embeddingDimension =
      dto.embeddingDimension !== undefined
        ? dto.embeddingDimension
        : (existing?.embeddingDimension ??
          (embeddingModel
            ? resolveEmbeddingDimension(
                embeddingModel,
                catalog.defaultEmbeddingDimension ?? 1536,
              )
            : 1536));

    const entity: Partial<LlmSettingsEntity> = {
      id: LLM_SETTINGS_SINGLETON_ID,
      provider,
      apiKeyEncrypted,
      baseUrl,
      chatModel,
      orchestratorChatModel,
      temperature,
      embeddingProvider,
      embeddingModel,
      embeddingDimension,
      extras,
      httpReferer:
        dto.httpReferer !== undefined
          ? dto.httpReferer?.trim() || null
          : (existing?.httpReferer ?? null),
      appTitle:
        dto.appTitle !== undefined
          ? dto.appTitle?.trim() || null
          : (existing?.appTitle ?? null),
      updatedBy: userId ?? null,
    };

    await this.repo.save(entity);
    const runtime = await this.refreshActiveConfig();
    return this.toMasked(runtime, await this.findRow());
  }

  async testConnection(dto?: UpdateLlmSettingsDto): Promise<LlmTestConnectionResult> {
    let runtime: LlmRuntimeConfig;
    if (dto && this.hasTestPayload(dto)) {
      runtime = this.buildPreviewRuntime(dto, await this.findRow());
    } else {
      runtime = await this.getEffective();
    }

    if (!runtime.apiKey) {
      return {
        ok: false,
        message: 'API key no configurada. Guarda una clave válida o define LLM_API_KEY en env.',
      };
    }

    const url = `${runtime.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${runtime.apiKey}`,
    };
    if (runtime.httpReferer) headers['HTTP-Referer'] = runtime.httpReferer;
    if (runtime.appTitle) headers['X-OpenRouter-Title'] = runtime.appTitle;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: runtime.chatModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 8,
          temperature: 0,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        return {
          ok: false,
          statusCode: res.status,
          message: text.slice(0, 500) || res.statusText,
          model: runtime.chatModel,
        };
      }
      return {
        ok: true,
        statusCode: res.status,
        message: 'Conexión correcta con el proveedor LLM.',
        model: runtime.chatModel,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        model: runtime.chatModel,
      };
    }
  }

  private hasTestPayload(dto: UpdateLlmSettingsDto): boolean {
    return Boolean(
      dto.provider ||
        dto.apiKey?.trim() ||
        dto.baseUrl?.trim() ||
        dto.chatModel?.trim(),
    );
  }

  private buildPreviewRuntime(
    dto: UpdateLlmSettingsDto,
    existing: LlmSettingsEntity | null,
  ): LlmRuntimeConfig {
    const provider = dto.provider ?? existing?.provider ?? this.envProvider();
    if (!isProviderId(provider)) {
      throw new ForbiddenException(`Proveedor no soportado: ${provider}`);
    }
    const catalog = getCatalogEntry(provider)!;
    let apiKey = '';
    if (dto.apiKey?.trim()) {
      apiKey = dto.apiKey.trim();
    } else if (existing?.apiKeyEncrypted) {
      try {
        apiKey = decrypt(existing.apiKeyEncrypted);
      } catch {
        apiKey = '';
      }
    } else {
      apiKey = process.env.LLM_API_KEY?.trim() ?? '';
    }

    const extras = dto.extras ?? existing?.extras ?? {};
    const accountId = resolveCloudflareAccountId(extras, dto.baseUrl ?? existing?.baseUrl);
    let baseUrl = dto.baseUrl?.trim() || existing?.baseUrl?.trim() || catalog.defaultBaseUrl;
    if (provider === 'cloudflare' && accountId) {
      baseUrl = buildCloudflareBaseUrl(accountId);
    }

    const chatModel =
      dto.chatModel?.trim() || existing?.chatModel?.trim() || catalog.defaultChatModel;
    const orchestratorChatModel =
      dto.orchestratorChatModel !== undefined
        ? dto.orchestratorChatModel?.trim() || chatModel
        : (existing?.orchestratorChatModel?.trim() || chatModel);
    const temperature =
      dto.temperature !== undefined
        ? dto.temperature
        : (existing?.temperature ?? this.envTemperature());
    const embeddingProvider =
      (dto.embeddingProvider !== undefined
        ? dto.embeddingProvider
        : (existing?.embeddingProvider as ProviderId | null)) ??
      (catalog.supportsEmbeddings ? provider : null);
    const embeddingModel =
      dto.embeddingModel ??
      existing?.embeddingModel ??
      catalog.defaultEmbeddingModel;
    const embeddingDimension =
      dto.embeddingDimension ??
      existing?.embeddingDimension ??
      (embeddingModel
        ? resolveEmbeddingDimension(
            embeddingModel,
            catalog.defaultEmbeddingDimension ?? 1536,
          )
        : 1536);

    return {
      provider,
      apiKey,
      baseUrl,
      chatModel,
      orchestratorChatModel,
      temperature,
      embeddingProvider,
      embeddingModel,
      embeddingDimension,
      extras: extras ?? {},
      httpReferer:
        dto.httpReferer !== undefined
          ? dto.httpReferer?.trim() || null
          : (existing?.httpReferer ?? process.env.LLM_HTTP_REFERER?.trim() ?? null),
      appTitle:
        dto.appTitle !== undefined
          ? dto.appTitle?.trim() || null
          : (existing?.appTitle ?? process.env.LLM_APP_TITLE?.trim() ?? null),
      source: 'db',
    };
  }

  private async findRow(): Promise<LlmSettingsEntity | null> {
    return this.repo.findOne({ where: { id: LLM_SETTINGS_SINGLETON_ID } });
  }

  private buildFromRow(row: LlmSettingsEntity): LlmRuntimeConfig {
    const provider = isProviderId(row.provider) ? row.provider : 'openrouter';
    const catalog = getCatalogEntry(provider)!;
    let apiKey = '';
    if (row.apiKeyEncrypted) {
      try {
        apiKey = decrypt(row.apiKeyEncrypted);
      } catch (err) {
        this.logger.error(
          `Failed to decrypt LLM API key: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    const extras = row.extras ?? {};
    const accountId = resolveCloudflareAccountId(extras, row.baseUrl);
    let baseUrl = row.baseUrl?.trim() || catalog.defaultBaseUrl;
    if (provider === 'cloudflare' && accountId) {
      baseUrl = buildCloudflareBaseUrl(accountId);
    }
    const chatModel = row.chatModel?.trim() || catalog.defaultChatModel;
    const orchestratorChatModel = row.orchestratorChatModel?.trim() || chatModel;
    const embeddingModel = row.embeddingModel ?? catalog.defaultEmbeddingModel;
    const embeddingDimension =
      row.embeddingDimension ??
      (embeddingModel
        ? resolveEmbeddingDimension(
            embeddingModel,
            catalog.defaultEmbeddingDimension ?? 1536,
          )
        : 1536);

    return {
      provider,
      apiKey,
      baseUrl,
      chatModel,
      orchestratorChatModel,
      temperature: row.temperature ?? this.envTemperature(),
      embeddingProvider: (row.embeddingProvider as ProviderId | null) ?? null,
      embeddingModel,
      embeddingDimension,
      extras,
      httpReferer: row.httpReferer ?? null,
      appTitle: row.appTitle ?? null,
      source: 'db',
    };
  }

  private buildFromEnv(): LlmRuntimeConfig {
    const provider = this.envProvider();
    const catalog = getCatalogEntry(provider) ?? getCatalogEntry('openrouter')!;
    const chatModel =
      process.env.LLM_MODEL_INGEST?.trim() ||
      process.env.LLM_CHAT_MODEL?.trim() ||
      catalog.defaultChatModel ||
      LLM_DEFAULT_CHAT_MODEL;
    const orchestratorChatModel =
      process.env.ORCHESTRATOR_LLM_MODEL?.trim() ||
      process.env.LLM_CHAT_MODEL?.trim() ||
      chatModel;
    const embeddingModel =
      process.env.LLM_EMBEDDING_MODEL?.trim() ||
      catalog.defaultEmbeddingModel ||
      LLM_DEFAULT_EMBEDDING_MODEL;
    const embeddingDimension = (() => {
      const raw = process.env.LLM_EMBEDDING_DIM?.trim();
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= 1) return n;
      return resolveEmbeddingDimension(
        embeddingModel,
        catalog.defaultEmbeddingDimension ?? 1536,
      );
    })();

    return {
      provider,
      apiKey: process.env.LLM_API_KEY?.trim() ?? '',
      baseUrl: process.env.LLM_BASE_URL?.trim() || catalog.defaultBaseUrl || LLM_DEFAULT_BASE,
      chatModel,
      orchestratorChatModel,
      temperature: this.envTemperature(),
      embeddingProvider: catalog.supportsEmbeddings ? provider : null,
      embeddingModel,
      embeddingDimension,
      extras: {},
      httpReferer: process.env.LLM_HTTP_REFERER?.trim() || null,
      appTitle: process.env.LLM_APP_TITLE?.trim() || null,
      source: 'env',
    };
  }

  private envProvider(): ProviderId {
    const p = process.env.LLM_PROVIDER?.trim() || 'openrouter';
    return isProviderId(p) ? p : 'openrouter';
  }

  private envTemperature(): number {
    const n = parseFloat(process.env.LLM_TEMPERATURE || '0.1');
    return Number.isFinite(n) ? n : 0.1;
  }

  private toMasked(
    runtime: LlmRuntimeConfig,
    row: LlmSettingsEntity | null,
  ): LlmSettingsMasked {
    return {
      provider: runtime.provider,
      apiKeyHint: maskApiKeyHint(runtime.apiKey),
      hasApiKey: Boolean(runtime.apiKey),
      baseUrl: runtime.baseUrl,
      chatModel: runtime.chatModel,
      orchestratorChatModel:
        runtime.orchestratorChatModel !== runtime.chatModel
          ? runtime.orchestratorChatModel
          : null,
      temperature: runtime.temperature,
      embeddingProvider: runtime.embeddingProvider,
      embeddingModel: runtime.embeddingModel,
      embeddingDimension: runtime.embeddingDimension,
      extras: runtime.extras,
      httpReferer: runtime.httpReferer,
      appTitle: runtime.appTitle,
      source: runtime.source,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  }
}
