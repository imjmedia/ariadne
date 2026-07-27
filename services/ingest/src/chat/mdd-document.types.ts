/**
 * Contrato MDD (7 secciones + `multi_root`) para ask_codebase con responseMode evidence_first — consumo por The Forge / LegacyCoordinator.
 */
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
  openapi_spec: {
    found: boolean;
    path: string | null;
    trust_level: 'high' | 'medium' | 'low';
    /** true si manifestDeps agregado del proyecto incluye @nestjs/swagger / swagger-ui / openapi */
    swagger_dependencies?: boolean;
    /** Rutas de File en Falkor cuyo path sugiere configuración Swagger/OpenAPI (sin ser spec indexada). */
    swagger_related_paths?: string[];
    /** Markdown u otros docs del alcance que parecen inventario/manual de API (evidencia textual). */
    supplementary_doc_paths?: string[];
    /** Contenido legible (extracto) de supplementary_doc_paths vía getFileSnippet. */
    supplementary_docs?: Array<{
      path: string;
      excerpt: string;
      truncated: boolean;
      total_chars: number;
    }>;
    /** Aclaración para consumidores (p. ej. spec generada en build y no commiteada). */
    notes?: string;
  };
  entities: Array<{ name: string; source: 'prisma' | 'typeorm' | 'strapi' | 'frontend'; fields: string[] }>;
  api_contracts: Array<{ route: string; methods: string[]; doc_source: 'swagger' | 'ast' | 'strapi' }>;
  business_logic: Array<{ service: string; dependencies: string[] }>;
  infrastructure: { orm: string; env_vars: string[] };
  risk_report: { complexity: number; anti_patterns: string[] };
  evidence_paths: string[];
  /** Composición del workspace Ariadne y enlaces cross-repo (presente si el repo pertenece a un proyecto). */
  multi_root?: MddMultiRootBlock;
}
