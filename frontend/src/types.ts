/**
 * @fileoverview Tipos e interfaces del frontend Ariadne (Repository, SyncJob, JobAnalysisResult, etc.).
 */

/** Estados del repositorio en el frontend. */
export type RepositoryStatus = 'pending' | 'syncing' | 'ready' | 'error';

/** Entidad repositorio (Bitbucket/GitHub). */
/** Entrada de alcance de indexado por repo (ingest). */
export type IndexIncludeEntry =
  | { kind: 'path_prefix'; path: string }
  | { kind: 'file'; path: string };

export type IndexIncludeRules = { entries: IndexIncludeEntry[] };

export interface Repository {
  id: string;
  provider: string;
  projectKey: string;
  repoSlug: string;
  defaultBranch: string;
  credentialsRef: string | null;
  lastSyncAt: string | null;
  lastCommitSha?: string | null;
  status: RepositoryStatus;
  projectId?: string | null;
  /** IDs de proyectos a los que pertenece (vía project_repositories). Vacío = usa id como projectId en MCP. */
  projectIds?: string[];
  /** Null = indexar todo el repo (filtro global). Si existe, ver documentación en edición de repo. */
  indexIncludeRules?: IndexIncludeRules | null;
  /** The Forge project UUID — converge after reindex (brownfield). */
  theforgeProjectId?: string | null;
  theforgeStageId?: string | null;
  theforgeConvergePersist?: boolean;
  theforgeConvergeTriggerMode?: TheForgeConvergeTriggerMode;
  autoMddOnFullSync?: boolean;
  indexTestsEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TheForgeConvergeTriggerMode = 'off' | 'full' | 'incremental' | 'all';

/** Proyecto multi-root: agrupa N repositorios. */
export interface Project {
  id: string;
  name: string | null;
  description: string | null;
  /** Dominio de gobierno (whitelist / shards). */
  domainId?: string | null;
  domainName?: string | null;
  domainColor?: string | null;
  /** Proyecto brownfield (LEGACY) vinculado en The Forge. */
  theforgeProjectId?: string | null;
  theforgeProjectName?: string | null;
  createdAt: string;
  updatedAt: string;
  repositories: Array<{
    id: string;
    provider: string;
    projectKey: string;
    repoSlug: string;
    defaultBranch: string;
    status: string;
    lastSyncAt: string | null;
    /** Etiqueta multi-root para inferencia de alcance en chat (ingest). */
    role?: string | null;
  }>;
}

/** Dominio de arquitectura (PostgreSQL). */
export interface Domain {
  id: string;
  name: string;
  description: string | null;
  color: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  /** Proyectos con domain_id = este dominio (listado GET /domains). */
  assignedProjectCount?: number;
}

/** Arista de visibilidad dominio → dominio (shards). Tabla `domain_domain_visibility`. */
export interface DomainVisibilityEdge {
  id: string;
  fromDomainId: string;
  toDomainId: string;
  toDomainName?: string;
  description: string | null;
  createdAt: string;
}

export interface ProjectDomainDependency {
  id: string;
  projectId: string;
  dependsOnDomainId: string;
  dependsOnDomainName?: string;
  connectionType: string;
  description: string | null;
  createdAt: string;
}

/** Tipo de job (full sync o incremental). */
export type SyncJobType = 'full' | 'incremental';
/** Estado del job. */
export type SyncJobStatus = 'queued' | 'running' | 'completed' | 'failed';

/** Resultado de análisis de job incremental (impacto, seguridad). */
export interface JobAnalysisResult {
  jobId: string;
  repositoryId: string;
  type: string;
  paths: string[];
  summary: {
    riskScore: number;
    totalPaths: number;
    securityFindings: number;
    dependentModules: number;
  };
  impacto: {
    dependents: Array<{ path: string; dependents: string[] }>;
  };
  seguridad: {
    findings: Array<{
      path: string;
      severity: 'critica' | 'alta' | 'media';
      pattern: string;
      line?: number;
    }>;
  };
  resumenEjecutivo: string;
}

/** Job de sincronización. */
export interface SyncJob {
  id: string;
  repositoryId: string;
  type: SyncJobType;
  startedAt: string;
  finishedAt: string | null;
  status: SyncJobStatus;
  payload?: Record<string, unknown> | null;
  errorMessage: string | null;
}

/** Job activo (queued/running) con datos mínimos del repo (cola global). */
export interface ActiveSyncJob extends SyncJob {
  repository: {
    id: string;
    provider: string;
    projectKey: string;
    repoSlug: string;
    defaultBranch: string;
  };
}

/** DTO para crear repositorio (provider, projectKey, repoSlug; opcional projectId para multi-root). */
export interface CreateRepositoryDto {
  provider: 'bitbucket' | 'github';
  projectKey: string;
  repoSlug: string;
  defaultBranch?: string;
  credentialsRef?: string | null;
  webhookSecret?: string | null;
  /** ID del proyecto al que pertenece (multi-root). Si no se envía, se crea proyecto 1:1. */
  projectId?: string | null;
}

/** DTO para actualizar repositorio (defaultBranch, credentialsRef, webhookSecret, projectId). */
export interface UpdateRepositoryDto {
  defaultBranch?: string;
  credentialsRef?: string | null;
  webhookSecret?: string | null;
  projectId?: string | null;
  readEmbeddingSpaceId?: string | null;
  writeEmbeddingSpaceId?: string | null;
  /** Null = indexado completo; objeto = reglas por repo. */
  indexIncludeRules?: IndexIncludeRules | null;
  theforgeProjectId?: string | null;
  theforgeStageId?: string | null;
  theforgeConvergePersist?: boolean;
  theforgeConvergeTriggerMode?: TheForgeConvergeTriggerMode;
  /** Service JWT The Forge. Vacío borra; omitido no cambia. */
  theforgeServiceToken?: string | null;
  autoMddOnFullSync?: boolean;
  indexTestsPreset?: boolean;
}

/** Entidad credencial (token, app_password, webhook_secret). */
export interface Credential {
  id: string;
  provider: string;
  kind: string;
  name: string | null;
  extra?: Record<string, unknown> | null;
  userId?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** DTO para crear credencial. */
export interface CreateCredentialDto {
  provider: 'bitbucket' | 'github';
  kind: 'token' | 'app_password' | 'webhook_secret';
  value: string;
  name?: string | null;
  extra?: Record<string, unknown> | null;
}

/** DTO para actualizar credencial (name, value, extra). */
export interface UpdateCredentialDto {
  value?: string;
  name?: string | null;
  extra?: Record<string, unknown> | null;
  /** Reasignar propietario (admin: cualquier user id; resto: solo tu id para reclamar legado). */
  userId?: string | null;
}

/** Hallazgo crítico de Full Audit. */
export interface CriticalFinding {
  hallazgo: string;
  impacto: string;
  esfuerzo: string;
  prioridad: 'critica' | 'alta' | 'media' | 'baja';
  categoria?: string;
  /** Path del archivo para localizar la corrección (ej. src/foo.ts) */
  path?: string;
  /** Línea en el archivo cuando aplica (ej. secreto expuesto) */
  line?: number;
  /** Nombre de función/clase cuando aplica */
  name?: string;
}

/** Alcance opcional para chat y analyze (alineado con ingest). */
export interface ChatScope {
  repoIds?: string[];
  includePathPrefixes?: string[];
  excludePathGlobs?: string[];
}

/** UI The Forge (RepoChat / ProjectChat): alineado con `responseMode` + `deterministicRetriever` del ingest. */
export type ChatPipelineMode = 'default' | 'evidence_first' | 'raw_evidence_fast';

export interface IngestChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  cypher?: string;
  result?: unknown[];
}

/** Body de `POST /repositories/:id/chat` y `POST /projects/:id/chat` (proxy ingest). */
export interface IngestChatRequestBody {
  message: string;
  history?: IngestChatHistoryEntry[];
  scope?: ChatScope;
  twoPhase?: boolean;
  responseMode?: 'default' | 'evidence_first' | 'raw_evidence';
  deterministicRetriever?: boolean;
  strictChatScope?: boolean;
  integrationHandoffId?: string | null;
  chatMode?: 'integration_handoff' | string | null;
}

export interface IngestChatResponse {
  answer: string;
  cypher?: string;
  result?: unknown[];
  mddDocument?: Record<string, unknown>;
}

/** Conversación persistida por usuario (repo o proyecto). */
export interface ChatConversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  integrationBatchId?: string | null;
  integrationBatchLabel?: string | null;
  integrationHandoffId?: string | null;
}

export interface ForgeIntegrationHandoffSource {
  forgeProjectId: string;
  forgeProjectName: string;
  groupName?: string | null;
  sentHandoffCount: number;
  linkedLegacyProjectId?: string | null;
}

export interface ImportIntegrationHandoffsResponse {
  batchId: string;
  batchLabel: string;
  sourceForgeProjectId: string;
  sourceForgeProjectName: string;
  created: Array<{ conversationId: string; handoffId: string; title: string }>;
  skipped: Array<{ handoffId: string; title: string; reason: string }>;
}

export interface ChatIntegrationBatch {
  id: string;
  label: string;
  sourceForgeProjectId: string;
  sourceForgeProjectName: string | null;
  conversationCount: number;
  forgePromotionStatus: string | null;
  forgeStageId: string | null;
  forgeStageUrl: string | null;
  createdAt: string;
}

/** Mensaje persistido en Postgres. */
export interface ChatConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cypher: string | null;
  createdAt: string;
}

/** Deliverables solicitados al promover chat → The Forge. */
export type ForgeDeliverableKind =
  | 'change_spec'
  | 'data_model'
  | 'api_contracts'
  | 'modification_plan'
  | 'migration_tasks'
  | 'mdd_full';

export type ForgePromotionStatus = 'none' | 'pending' | 'success' | 'failed';

export interface ForgePromotionState {
  status: ForgePromotionStatus;
  forgeProjectId: string | null;
  forgeStageId: string | null;
  promotedAt: string | null;
  lastError: string | null;
  stageUrl: string | null;
  idempotencyKey: string | null;
}

export interface TheForgePackPreview {
  changeTitle: string;
  stageKeySuggested: string;
  userDescription: string;
  hasMermaid: boolean;
  erDiagramPreview: string | null;
  modificationPlanFileCount: number;
  modificationPlanSample: string[];
  indexFresh: boolean;
  indexStaleHours: number | null;
  warnings: string[];
  messageCount: number;
}

export interface PreviewTheForgePackResponse {
  preview: TheForgePackPreview;
  linkedForgeProject?: {
    forgeProjectId: string;
    forgeProjectName: string;
    linkKind: 'primary' | 'alias' | 'inferred';
  } | null;
  promoteEnabled: boolean;
}

export interface PreviewIntegrationBatchTheForgeResponse {
  batch: ChatIntegrationBatch;
  preview: {
    stageName: string;
    stageKeySuggested: string;
    conversationCount: number;
    modificationPlanFileCount: number;
    modificationPlanSample: string[];
    warnings: string[];
  };
  linkedForgeProject?: {
    forgeProjectId: string;
    forgeProjectName: string;
    linkKind: 'primary' | 'alias' | 'inferred';
  } | null;
  /** Proyecto LEGACY que se usará al promover (explícito o vinculado por defecto). */
  targetForgeProject?: {
    forgeProjectId: string;
    forgeProjectName: string;
    linkKind: 'primary' | 'explicit';
  } | null;
  promoteEnabled: boolean;
}

export interface PromoteToTheForgeRequest {
  stageName: string;
  stageKey?: string;
  deliverables: ForgeDeliverableKind[];
  activate?: boolean;
  forgeProjectId?: string;
}

export interface PromoteToTheForgeResponse {
  status: 'success';
  alreadyPromoted: boolean;
  forgeProjectId: string | null;
  forgeProjectName?: string;
  forgeStageId: string | null;
  stageKey?: string;
  stageName?: string;
  stageUrl?: string | null;
  importMode?: 'create' | 'import';
  legacyStart?: { triggered?: boolean; skipped?: boolean; reason?: string };
  ariadneWire?: { linked?: boolean; linkKind?: string; warnings?: string[] };
  recommendedNextTools?: string[];
  deliverablesCreated?: string[];
  warnings?: string[];
  linkKind?: string;
}

export interface ProjectTheForgeStageRequest {
  stageName: string;
  changeDescription: string;
  stageKey?: string;
  conversationId?: string;
  deliverables?: ForgeDeliverableKind[];
  activate?: boolean;
}

export interface ProjectTheForgeStagePreview {
  stageName: string;
  stageKeySuggested: string;
  changeDescription: string;
  changeWorkDescription: string;
  cursorTasksMarkdown: string;
  cursorTasksSource: 'llm' | 'fallback';
  modificationPlanFileCount: number;
  modificationPlanSample: string[];
  indexFresh: boolean;
  indexStaleHours: number | null;
  warnings: string[];
  forgeProjectId: string;
  forgeProjectName: string | null;
}

export interface CreateProjectTheForgeStageResponse {
  status: 'success';
  forgeProjectId: string;
  forgeProjectName: string | null;
  forgeStageId: string;
  stageKey?: string;
  stageName?: string;
  stageUrl?: string;
  importMode?: 'create' | 'import';
  legacyStart?: { triggered?: boolean; skipped?: boolean; reason?: string };
  ariadneWire?: { linked?: boolean; linkKind?: string; warnings?: string[] };
  recommendedNextTools?: string[];
  deliverablesCreated?: string[];
  changeWorkDescription?: string;
  cursorTasksMarkdown?: string;
  warnings?: string[];
}

export interface ForgeProjectCandidate {
  forgeProjectId: string;
  forgeProjectName: string;
  linkKind: string;
}

/** Proyecto brownfield (LEGACY) listado desde The Forge. */
export interface ForgeBrownfieldProjectOption {
  id: string;
  name: string;
  groupName?: string | null;
  projectType: 'LEGACY';
}

export interface ForgeBrownfieldProjectsResponse {
  projects: ForgeBrownfieldProjectOption[];
  hint?: string;
}

/** Estado público: ¿mostrar promoción chat → The Forge? */
export interface TheForgeIntegrationStatus {
  chatPromotionAvailable: boolean;
  mock: boolean;
  enabled: boolean;
}

/** Ajustes admin (The Forge opcional). */
export interface TheForgeIntegrationSettings {
  enabled: boolean;
  apiUrl: string | null;
  hasServiceToken: boolean;
  serviceTokenHint: string | null;
  envApiUrlConfigured: boolean;
}

export interface UpdateTheForgeIntegrationDto {
  enabled?: boolean;
  apiUrl?: string | null;
  serviceToken?: string | null;
}

/** Metadatos de `POST .../analyze` (caché, foco, cobertura). */
export interface AnalyzeReportMeta {
  scopeApplied: boolean;
  focusPrefixes: string[];
  filesAnalyzedInFocus: number;
  filesTotalInFocus: number;
  graphCoverageNote?: string;
  fromCache?: boolean;
  cacheFingerprintMode?: 'full' | 'degraded';
  cacheScopePartitioned?: boolean;
  extrinsicCallsLayerCacheHit?: boolean;
  extrinsicCallsLayerRedisHit?: boolean;
}

/** Modos de análisis de código expuestos en la UI de chat. */
export type AnalyzeCodeMode =
  | 'diagnostico'
  | 'duplicados'
  | 'reingenieria'
  | 'codigo_muerto'
  | 'seguridad'
  | 'agents'
  | 'skill';

/** Respuesta JSON de analyze en ingest. */
export interface AnalyzeApiResult {
  mode: string;
  summary: string;
  details?: unknown;
  reportMeta?: AnalyzeReportMeta;
}

/** Resultado de Full Repo Audit. */
export interface FullAuditResult {
  executiveSummary: string;
  healthScore: number;
  topRisks: string[];
  techDebtEstimateHours: number;
  criticalFindings: CriticalFinding[];
  actionPlan: string[];
  arquitectura: {
    godObjects: Array<{ path: string; lineCount?: number; dependencyCount?: number; reason: string }>;
    circularImports: Array<[string, string]>;
    highComplexityFunctions: Array<{ path: string; name: string; complexity: number }>;
  };
  seguridad: {
    leakedSecrets: Array<{ path: string; severity: string; pattern: string; line?: number }>;
  };
  saludCodigo: {
    codigoMuerto: Array<{ path: string; category: string; exportsSummary?: string }>;
    duplicados: Array<{ a: string; b: string; score?: number }>;
  };
}

/** Proveedores LLM soportados (catálogo ingest). */
export type LlmProviderId =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'cloudflare';

export interface LlmProviderCatalogEntry {
  id: LlmProviderId;
  label: string;
  apiKeyHelpUrl?: string;
  defaultChatModel: string;
  chatModels?: string[];
  defaultEmbeddingModel: string | null;
  embeddingModels?: string[];
  defaultEmbeddingDimension: number | null;
  defaultBaseUrl: string;
  baseUrlEditable?: boolean;
  extraFields?: Array<{
    key: string;
    label: string;
    required: boolean;
    placeholder?: string;
    helpText?: string;
  }>;
  supportsEmbeddings: boolean;
}

export interface LlmSettingsMasked {
  provider: LlmProviderId;
  apiKeyHint: string | null;
  hasApiKey: boolean;
  baseUrl: string;
  chatModel: string;
  orchestratorChatModel: string | null;
  orchestratorRouterModel: string | null;
  orchestratorWorkerModel: string | null;
  chatIntentRouterEnabled: boolean;
  temperature: number;
  embeddingProvider: LlmProviderId | null;
  embeddingModel: string | null;
  embeddingDimension: number;
  extras: Record<string, unknown>;
  httpReferer: string | null;
  appTitle: string | null;
  source: 'db' | 'env';
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UpdateLlmSettingsDto {
  provider?: LlmProviderId;
  apiKey?: string;
  baseUrl?: string;
  chatModel?: string;
  orchestratorChatModel?: string | null;
  orchestratorRouterModel?: string | null;
  orchestratorWorkerModel?: string | null;
  chatIntentRouterEnabled?: boolean;
  temperature?: number;
  embeddingProvider?: LlmProviderId | null;
  embeddingModel?: string | null;
  embeddingDimension?: number;
  extras?: Record<string, unknown>;
  httpReferer?: string | null;
  appTitle?: string | null;
}

export interface LlmTestConnectionResult {
  ok: boolean;
  statusCode?: number;
  message: string;
  model?: string;
}

/** Configuración global del sistema (Ajustes → Sistema). */
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
