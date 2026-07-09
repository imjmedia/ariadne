/**
 * @fileoverview Types for validate_change_plan (contract v1).
 */

export const CHANGE_PLAN_SCHEMA_VERSION = '1.0' as const;

export type ChangePlanSource = 'theforge' | 'cursor' | 'ci' | 'mcp';

export type ChangePlanFileChangeType = 'add' | 'modify' | 'delete' | 'unknown';

export type ApiChangeType = 'add' | 'modify' | 'remove';

export type PlanVerdict = 'APPROVED' | 'APPROVED_WITH_WARNINGS' | 'BLOCKED';

export type PlanCheckStatus = 'pass' | 'warn' | 'fail';

export interface ChangePlanScope {
  repoIds?: string[];
  includePathPrefixes?: string[];
  excludePathGlobs?: string[];
}

export interface ChangePlanChangeScope {
  description: string;
  affectedRoutes?: Array<{ url: string; screen: string; components?: string[] }>;
  newFields?: Array<{ form: string; field: string; component: string; type?: string }>;
  affectedEndpoints?: Array<{ method: string; path: string; changeType: string }>;
}

export interface ChangePlanFile {
  path: string;
  repoId?: string;
  changeType: ChangePlanFileChangeType;
  symbols?: string[];
}

export interface ChangePlanApiChange {
  method: string;
  path: string;
  changeType: ApiChangeType;
  dtoFields?: string[];
}

export interface ChangePlanTask {
  id?: string;
  title: string;
  files: string[];
  symbols?: string[];
  endpoints?: string[];
}

export interface ChangePlanReferencePlan {
  filesToModify: Array<{ path: string; repoId?: string }>;
}

/** Request body for POST /projects/:id/validate-change-plan */
export interface ChangePlan {
  schemaVersion: typeof CHANGE_PLAN_SCHEMA_VERSION;
  projectId: string;
  source: ChangePlanSource;
  changeDescription?: string;
  changeScope?: ChangePlanChangeScope;
  files: ChangePlanFile[];
  apiChanges?: ChangePlanApiChange[];
  tasks?: ChangePlanTask[];
  referencePlan?: ChangePlanReferencePlan;
  scope?: ChangePlanScope;
}

export interface PlanValidationCheck {
  id: string;
  status: PlanCheckStatus;
  message: string;
  paths?: string[];
}

export interface PlanValidationFileResult {
  path: string;
  existsInGraph: boolean;
  symbolsResolved: boolean;
  inReferencePlan: boolean;
  impactSummary?: string;
  dependentCount?: number;
}

export interface PlanValidationCoverage {
  missingFromPlan: string[];
  extraInPlan: string[];
  referenceOverlapRatio?: number;
}

export interface PlanValidationSuggestedFix {
  checkId: string;
  action: string;
}

/** Response from validate_change_plan */
export interface PlanValidationReport {
  schemaVersion: typeof CHANGE_PLAN_SCHEMA_VERSION;
  verdict: PlanVerdict;
  score: number;
  summary: string;
  checks: PlanValidationCheck[];
  fileResults: PlanValidationFileResult[];
  coverage: PlanValidationCoverage;
  blockers: string[];
  warnings: string[];
  suggestedFixes: PlanValidationSuggestedFix[];
}
