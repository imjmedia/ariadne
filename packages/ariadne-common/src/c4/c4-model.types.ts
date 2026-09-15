/**
 * @fileoverview Contrato C4Model v1 — capa intermedia entre Falkor/infra y Archify.
 */

export type C4Level = 'context' | 'container' | 'component' | 'code';

export type C4ElementKind = 'person' | 'system' | 'container' | 'component' | 'external';

export type C4EvidenceSource =
  | 'falkor'
  | 'compose'
  | 'domain'
  | 'navigation_map'
  | 'llm'
  | 'package_json';

/** Rol del repo cuando no hay docker-compose (front/back en repos separados). */
export type C4StackRole = 'frontend' | 'backend';

export interface C4Evidence {
  source: C4EvidenceSource;
  nodeId?: string;
  filePath?: string;
  lineRange?: [number, number];
  reason: string;
}

export interface C4Element {
  id: string;
  kind: C4ElementKind;
  name: string;
  technology?: string;
  description?: string;
  /** Clave estable del container en infra (slug) */
  containerKey?: string;
  repoId?: string;
  stackRole?: C4StackRole;
  evidence: C4Evidence[];
}

export interface C4Relationship {
  id: string;
  from: string;
  to: string;
  label?: string;
  protocol?: string;
  evidence: C4Evidence[];
}

export interface C4Model {
  schemaVersion: '1.0';
  projectId: string;
  repoId?: string;
  level: C4Level;
  generatedAt: string;
  generator: 'sync' | 'llm' | 'hybrid';
  contentHash: string;
  systemName?: string;
  elements: C4Element[];
  relationships: C4Relationship[];
}
