import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSystemSettingsBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  corsOrigin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  emailOtp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  ssoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  webAppHost?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  smtpHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  smtpUser?: string | null;

  @IsOptional()
  @IsString()
  smtpPass?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  smtpFrom?: string | null;

  @IsOptional()
  @IsBoolean()
  falkorShardByProject?: boolean;

  @IsOptional()
  @IsBoolean()
  falkorShardByDomain?: boolean;

  @IsOptional()
  @IsBoolean()
  falkorAutoDomainOverflow?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(10_000_000)
  falkorGraphNodeSoftLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  falkorDebugCypher?: boolean;

  @IsOptional()
  @IsBoolean()
  metricsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  chatTelemetryLog?: boolean;

  @IsOptional()
  @IsBoolean()
  chatTwoPhase?: boolean;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(5000)
  modificationPlanMaxFiles?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  ollamaBaseUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ollamaEmbedModel?: string | null;

  @IsOptional()
  @IsString()
  githubToken?: string | null;
}
