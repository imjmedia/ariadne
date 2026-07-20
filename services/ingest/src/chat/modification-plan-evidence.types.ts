/**
 * Graph-backed evidence attached to modification-plan files (promote + Gate 1 seeds).
 */

export type GraphEvidenceRefKind = 'path' | 'symbol' | 'endpoint' | 'prop';

export interface GraphEvidenceRef {
  kind: GraphEvidenceRefKind;
  ref: string;
}

export interface GraphEvidenceDependent {
  symbol: string;
  count: number;
  breakingRisk: 'low' | 'medium' | 'high';
}

export interface GraphEvidenceProp {
  component: string;
  name: string;
  required?: boolean;
}

export interface GraphEvidenceEndpoint {
  method: string;
  path: string;
}

export interface GraphEvidenceFile {
  path: string;
  repoId: string;
  symbols: string[];
  dependents: GraphEvidenceDependent[];
  props: GraphEvidenceProp[];
  apiTouches: GraphEvidenceEndpoint[];
  impactScore: number;
}

export interface GraphEvidenceBundle {
  schemaVersion: '1.0';
  generatedAt: string;
  projectId: string;
  files: GraphEvidenceFile[];
}

/** ChangePlanTask-compatible seed (Gate 1 / promote). */
export interface ModificationPlanTaskSeed {
  id: string;
  title: string;
  files: string[];
  symbols?: string[];
  endpoints?: string[];
  phase?: string;
  criterion?: string;
  evidence?: GraphEvidenceRef[];
  dependsOn?: string[];
}
