import type { UpdateSystemSettingsDto } from '../system-settings.types';

export class UpdateSystemSettingsBodyDto implements UpdateSystemSettingsDto {
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
