export const SYSTEM_SETTINGS_SINGLETON_ID = 'default';

export interface SystemSmtpEffective {
  host: string | null;
  port: number;
  user: string | null;
  pass: string | null;
  from: string | null;
}

export interface SystemFalkorEffective {
  shardByProject: boolean;
  shardByDomain: boolean;
  autoDomainOverflow: boolean;
  graphNodeSoftLimit: number;
  debugCypher: boolean;
}

export interface SystemObservabilityEffective {
  metricsEnabled: boolean;
  chatTelemetryLog: boolean;
}

export interface SystemChatEffective {
  twoPhase: boolean;
  modificationPlanMaxFiles: number;
}

export interface SystemSettingsEffective {
  corsOrigin: string | null;
  emailOtp: string | null;
  ssoUrl: string | null;
  webAppHost: string | null;
  smtp: SystemSmtpEffective;
  falkor: SystemFalkorEffective;
  observability: SystemObservabilityEffective;
  chat: SystemChatEffective;
}

export interface SystemSettingsMasked {
  corsOrigin: string | null;
  emailOtp: string | null;
  ssoUrl: string | null;
  webAppHost: string | null;
  smtp: {
    host: string | null;
    port: number;
    user: string | null;
    from: string | null;
    hasPass: boolean;
    passHint: string | null;
  };
  falkor: SystemFalkorEffective;
  observability: SystemObservabilityEffective;
  chat: SystemChatEffective;
}

export interface UpdateSystemSettingsDto {
  corsOrigin?: string | null;
  emailOtp?: string | null;
  ssoUrl?: string | null;
  webAppHost?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFrom?: string | null;
  falkorShardByProject?: boolean;
  falkorShardByDomain?: boolean;
  falkorAutoDomainOverflow?: boolean;
  falkorGraphNodeSoftLimit?: number | null;
  falkorDebugCypher?: boolean;
  metricsEnabled?: boolean;
  chatTelemetryLog?: boolean;
  chatTwoPhase?: boolean;
  modificationPlanMaxFiles?: number | null;
}
