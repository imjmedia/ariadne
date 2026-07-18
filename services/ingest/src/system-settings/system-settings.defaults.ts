import type { SystemSettingsEffective } from './system-settings.types';

function truthyEnv(name: string, defaultValue = false): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  if (!v) return defaultValue;
  return v === '1' || v === 'true' || v === 'yes';
}

function falsyEnv(name: string, defaultValue = true): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  return defaultValue;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function strEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  return v || null;
}

/** Valores por defecto desde env (bootstrap) o constantes de producto. */
export function buildSystemSettingsFromEnv(): SystemSettingsEffective {
  return {
    corsOrigin: strEnv('CORS_ORIGIN'),
    emailOtp: strEnv('EMAIL_OTP'),
    ssoUrl: strEnv('SSO_URL'),
    webAppHost: strEnv('WEB_APP_HOST') ?? strEnv('HOST'),
    smtp: {
      host: strEnv('SMTP_HOST'),
      port: intEnv('SMTP_PORT', 587),
      user: strEnv('SMTP_USER'),
      pass: strEnv('SMTP_PASS'),
      from: strEnv('SMTP_FROM'),
    },
    falkor: {
      shardByProject: truthyEnv('FALKOR_SHARD_BY_PROJECT'),
      shardByDomain: truthyEnv('FALKOR_SHARD_BY_DOMAIN'),
      autoDomainOverflow: truthyEnv('FALKOR_AUTO_DOMAIN_OVERFLOW'),
      graphNodeSoftLimit: intEnv('FALKOR_GRAPH_NODE_SOFT_LIMIT', 100_000),
      debugCypher: truthyEnv('FALKOR_DEBUG_CYPHER'),
    },
    observability: {
      metricsEnabled: falsyEnv('METRICS_ENABLED', true),
      chatTelemetryLog: truthyEnv('CHAT_TELEMETRY_LOG'),
    },
    chat: {
      twoPhase: falsyEnv('CHAT_TWO_PHASE', true),
      modificationPlanMaxFiles: intEnv('MODIFICATION_PLAN_MAX_FILES', 150),
    },
    integrations: {
      githubToken: strEnv('GITHUB_TOKEN') ?? strEnv('GH_TOKEN'),
      ollamaBaseUrl: strEnv('OLLAMA_BASE_URL'),
      ollamaEmbedModel: strEnv('OLLAMA_EMBED_MODEL'),
    },
  };
}
