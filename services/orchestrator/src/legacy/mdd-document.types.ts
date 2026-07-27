/** Contrato MDD (7 secciones + multi_root) — alineado con ingest `mdd-document.types`. */
export interface MddMultiRootRepository {
  repoId: string;
  slug: string;
  role: string | null;
  status: string;
  lastSyncAt: string | null;
  in_mdd_scope: boolean;
  is_primary: boolean;
}

export interface MddMultiRootBlock {
  projectId: string;
  projectName: string | null;
  repository_count: number;
  is_multi_root: boolean;
  repositories: MddMultiRootRepository[];
  mdd_scope_repo_ids: string[];
  cross_repo_links: {
    calls_api: number;
    calls_strapi_route: number;
    calls_nest_route: number;
    calls_graphql_query: number;
    total: number;
  };
  notes?: string;
}

export interface MddEvidenceDocument {
  summary: string;
  openapi_spec: { found: boolean; path: string | null; trust_level: 'high' | 'medium' | 'low' };
  entities: Array<{ name: string; source: 'prisma' | 'typeorm' | 'strapi'; fields: string[] }>;
  api_contracts: Array<{ route: string; methods: string[]; doc_source: 'swagger' | 'ast' | 'strapi' }>;
  business_logic: Array<{ service: string; dependencies: string[] }>;
  infrastructure: { orm: string; env_vars: string[] };
  risk_report: { complexity: number; anti_patterns: string[] };
  evidence_paths: string[];
  multi_root?: MddMultiRootBlock;
}
