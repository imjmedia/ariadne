import { createHash } from 'crypto';

/** Deliverables The Forge may generate from a change promotion pack. */
export type ForgeDeliverableKind =
  | 'change_spec'
  | 'data_model'
  | 'api_contracts'
  | 'modification_plan'
  | 'migration_tasks'
  | 'mdd_full';

export interface ChangePromotionAriadneContext {
  conversationId: string;
  conversationTitle: string | null;
  repositoryId: string | null;
  projectId: string;
  projectKey: string | null;
  repoSlug: string | null;
  commitSha: string | null;
  indexFresh: boolean;
  indexStaleHours: number | null;
}

export interface ChangePromotionChangeBlock {
  title: string;
  stageKey: string;
  userDescription: string;
  decisions: string[];
  erDiagramMermaid: string | null;
  migrationNotes: string | null;
}

export interface ChangePromotionPlanFile {
  path: string;
  repoId?: string;
}

export interface ChangePromotionPackV1 {
  schemaVersion: '1.1';
  source: 'ariadne';
  kind: 'change_promotion';
  generatedAt: string;
  idempotencyKey: string;
  ariadne: ChangePromotionAriadneContext;
  change: ChangePromotionChangeBlock;
  mdd: Record<string, unknown>;
  modificationPlan: {
    filesToModify: ChangePromotionPlanFile[];
    questionsToRefine?: string[];
  };
  /** Per-file graph evidence for Forge task generation (P0). */
  graphEvidenceBundle?: import('../chat/modification-plan-evidence.types').GraphEvidenceBundle;
  /** Pre-seeded ChangePlan (tasks with phase/criterion/evidence). */
  changePlanSeed?: import('../plan-validation/change-plan-validation.types').ChangePlan;
  /** Markdown descripción completa del trabajo (handoff Cursor / Forge). */
  changeWorkDescription?: string;
  /** Documento # Tasks para Cursor Agent (YAML + checklist). */
  cursorTasksMarkdown?: string;
  deliverablesRequested: ForgeDeliverableKind[];
  /**
   * `integration_handoff` — wiring NEW capability into existing LEGACY only (Forge batch import).
   * Default brownfield reengineering when omitted.
   */
  promotionScope?: 'integration_handoff' | 'brownfield_change';
  integrationHandoff?: {
    handoffId?: string | null;
    title?: string | null;
    sourceProject?: string | null;
    acceptanceCriteria?: string[];
  };
}

export interface ResolveForgeProjectInput {
  ariadneProjectId?: string;
  ariadneRepositoryId?: string;
  projectKey?: string;
  repoSlug?: string;
  gitRemoteUrl?: string;
}

export interface ForgeStageSummary {
  id: string;
  name: string;
  workflowStatus: string;
}

export interface ResolveForgeProjectResult {
  forgeProjectId: string;
  forgeProjectName: string;
  linkKind: 'primary' | 'alias' | 'inferred';
  existingStages?: ForgeStageSummary[];
  warnings?: string[];
}

export interface ForgeProjectCandidate {
  forgeProjectId: string;
  forgeProjectName: string;
  linkKind: 'primary' | 'alias' | 'inferred';
}

export class ForgeResolveAmbiguousError extends Error {
  constructor(public readonly candidates: ForgeProjectCandidate[]) {
    super('Multiple Forge projects match Ariadne context');
    this.name = 'ForgeResolveAmbiguousError';
  }
}

export class ForgeResolveNotFoundError extends Error {
  constructor(message = 'No Forge project linked to this Ariadne context') {
    super(message);
    this.name = 'ForgeResolveNotFoundError';
  }
}

export interface CreateStageFromPackInput {
  forgeProjectId: string;
  pack: ChangePromotionPackV1;
  stageName: string;
  stageId?: string;
  activate?: boolean;
  /** Default false when pack has filesToModify. */
  runLegacyStart?: boolean;
  /** Default true — Forge upserts project_ariadne_links. */
  wireAriadne?: boolean;
  /** Proyecto NEW origen cuando el pack fusiona handoffs NEW-LEG. */
  linkedNewProjectId?: string;
}

/** Pack shape expected by POST /theforge/create-stage-from-ariadne-change-pack */
export interface ForgeHandoffItem {
  /** Forge handoff item id (`ARIADNE-ART-01` for pack artifacts; `NEW-LEG-NN` for business requirements). */
  id: string;
  /** Document body (Forge `description` / `payload`). */
  description: string;
  kind: string;
  title: string;
  /** Legacy alias enviado por Ariadne; Forge normaliza a description/payload. */
  content: string;
  payload?: unknown;
  mimeType?: string;
}

export interface ForgeChangePackV1 {
  version: '1';
  changeDescription: string;
  ariadneChangeId: string;
  ariadneRepositoryId?: string;
  ariadneProjectId?: string;
  ariadneConversationId?: string;
  idempotencyKey?: string;
  filesToModify: ChangePromotionPlanFile[];
  questionsToRefine?: string[];
  handoffItems?: ForgeHandoffItem[];
  linkedNewProjectId?: string;
}

export interface ForgeCreateStageApiBody {
  forgeProjectId: string;
  pack: ForgeChangePackV1;
  stageId?: string;
  stageName: string;
  activate?: boolean;
  runLegacyStart?: boolean;
  wireAriadne?: boolean;
}

export interface ForgeLegacyStartInfo {
  triggered?: boolean;
  skipped?: boolean;
  reason?: string;
}

export interface ForgeAriadneWireInfo {
  linked?: boolean;
  linkKind?: string;
  warnings?: string[];
}

export interface CreateStageFromPackResult {
  forgeProjectId: string;
  forgeStageId: string;
  stageKey?: string;
  stageName?: string;
  stageUrl?: string;
  importMode?: 'create' | 'import';
  legacyStart?: ForgeLegacyStartInfo;
  ariadneWire?: ForgeAriadneWireInfo;
  recommendedNextTools?: string[];
  deliverablesCreated?: string[];
}

/** Forge handoff item id for Ariadne pack artifacts (not business NEW→LEG traces). */
export const FORGE_HANDOFF_ITEM_ID_REGEX = /^ARIADNE-ART-\d{2,}$/;

/** Business integration trace ids (project NEW handoff). */
export const FORGE_NEW_LEG_ITEM_ID_REGEX = /^NEW-LEG-\d{2,}$/;

/** Forge `ariadneChangePackV1Schema.changeDescription` max length. */
export const FORGE_CHANGE_DESCRIPTION_MAX = 8000;

/** Sequential Ariadne artifact id for pack handoff items (1-based). */
export function forgeHandoffItemId(sequence: number): string {
  const n = Number.isFinite(sequence) && sequence >= 1 ? Math.floor(sequence) : 1;
  return `ARIADNE-ART-${String(n).padStart(2, '0')}`;
}

export function slugifyStageKey(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 48);
  return base || 'CHANGE';
}

export function buildPromotionIdempotencyKey(
  conversationId: string,
  stageKey: string,
  commitSha: string | null,
): string {
  return createHash('sha256')
    .update(`${conversationId}:${stageKey}:${commitSha ?? ''}`)
    .digest('hex')
    .slice(0, 32);
}

export function buildProjectStageIdempotencyKey(
  projectId: string,
  stageKey: string,
  commitSha: string | null,
): string {
  return createHash('sha256')
    .update(`project:${projectId}:${stageKey}:${commitSha ?? ''}`)
    .digest('hex')
    .slice(0, 32);
}

export const INDEX_STALE_HOURS = 72;

export function computeIndexFreshness(lastSyncAt: Date | null): {
  indexFresh: boolean;
  indexStaleHours: number | null;
} {
  if (!lastSyncAt) return { indexFresh: false, indexStaleHours: null };
  const hours = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60);
  return {
    indexFresh: hours <= INDEX_STALE_HOURS,
    indexStaleHours: Math.round(hours * 10) / 10,
  };
}
