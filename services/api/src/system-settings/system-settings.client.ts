/**
 * Cliente HTTP al runtime de system_settings en ingest (red Docker interna).
 */
import { setFalkorRuntimeOverrides } from 'ariadne-common';

export interface SystemSettingsRuntime {
  corsOrigin: string | null;
  emailOtp: string | null;
  ssoUrl: string | null;
  webAppHost: string | null;
  smtp: {
    host: string | null;
    port: number;
    user: string | null;
    pass: string | null;
    from: string | null;
  };
  falkor: {
    shardByProject: boolean;
    shardByDomain: boolean;
    autoDomainOverflow: boolean;
    graphNodeSoftLimit: number;
    debugCypher: boolean;
  };
  observability: {
    metricsEnabled: boolean;
    chatTelemetryLog: boolean;
  };
  chat: {
    twoPhase: boolean;
    modificationPlanMaxFiles: number;
  };
  integrations: {
    githubToken: string | null;
    ollamaBaseUrl: string | null;
    ollamaEmbedModel: string | null;
  };
}

function buildFromEnv(): SystemSettingsRuntime {
  const truthy = (name: string) => {
    const v = (process.env[name] ?? '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  };
  const str = (name: string) => process.env[name]?.trim() || null;
  const int = (name: string, fb: number) => {
    const n = parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : fb;
  };
  return {
    corsOrigin: str('CORS_ORIGIN'),
    emailOtp: str('EMAIL_OTP'),
    ssoUrl: str('SSO_URL'),
    webAppHost: str('WEB_APP_HOST') ?? str('HOST'),
    smtp: {
      host: str('SMTP_HOST'),
      port: int('SMTP_PORT', 587),
      user: str('SMTP_USER'),
      pass: str('SMTP_PASS'),
      from: str('SMTP_FROM'),
    },
    falkor: {
      shardByProject: truthy('FALKOR_SHARD_BY_PROJECT'),
      shardByDomain: truthy('FALKOR_SHARD_BY_DOMAIN'),
      autoDomainOverflow: truthy('FALKOR_AUTO_DOMAIN_OVERFLOW'),
      graphNodeSoftLimit: int('FALKOR_GRAPH_NODE_SOFT_LIMIT', 100_000),
      debugCypher: truthy('FALKOR_DEBUG_CYPHER'),
    },
    observability: {
      metricsEnabled: process.env.METRICS_ENABLED !== '0' && process.env.METRICS_ENABLED !== 'false',
      chatTelemetryLog: truthy('CHAT_TELEMETRY_LOG'),
    },
    chat: {
      twoPhase:
        process.env.CHAT_TWO_PHASE !== '0' &&
        process.env.CHAT_TWO_PHASE?.toLowerCase() !== 'false' &&
        process.env.CHAT_TWO_PHASE?.toLowerCase() !== 'off',
      modificationPlanMaxFiles: int('MODIFICATION_PLAN_MAX_FILES', 150),
    },
    integrations: {
      githubToken: str('GITHUB_TOKEN') ?? str('GH_TOKEN'),
      ollamaBaseUrl: str('OLLAMA_BASE_URL'),
      ollamaEmbedModel: str('OLLAMA_EMBED_MODEL'),
    },
  };
}

let cached: SystemSettingsRuntime | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 15_000;

export async function getSystemSettingsRuntime(): Promise<SystemSettingsRuntime> {
  const now = Date.now();
  if (cached && now - cacheLoadedAt < CACHE_TTL_MS) return cached;

  const ingestUrl = (process.env.INGEST_URL ?? 'http://localhost:3002').replace(/\/$/, '');
  try {
    const res = await fetch(`${ingestUrl}/internal/system-settings`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = (await res.json()) as SystemSettingsRuntime;
      cached = json;
      cacheLoadedAt = now;
      setFalkorRuntimeOverrides({
        shardByProject: json.falkor.shardByProject,
        shardByDomain: json.falkor.shardByDomain,
        autoDomainOverflow: json.falkor.autoDomainOverflow,
        graphNodeSoftLimit: json.falkor.graphNodeSoftLimit,
        debugCypher: json.falkor.debugCypher,
      });
      return json;
    }
  } catch {
    /* fallback env */
  }

  cached = buildFromEnv();
  cacheLoadedAt = now;
  setFalkorRuntimeOverrides({
    shardByProject: cached.falkor.shardByProject,
    shardByDomain: cached.falkor.shardByDomain,
    autoDomainOverflow: cached.falkor.autoDomainOverflow,
    graphNodeSoftLimit: cached.falkor.graphNodeSoftLimit,
    debugCypher: cached.falkor.debugCypher,
  });
  return cached;
}

export function invalidateSystemSettingsCache(): void {
  cached = null;
  cacheLoadedAt = 0;
}

export async function prefetchSystemSettingsRuntime(): Promise<SystemSettingsRuntime> {
  return getSystemSettingsRuntime();
}
