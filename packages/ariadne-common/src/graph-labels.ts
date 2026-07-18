/**
 * Etiquetas Falkor alineadas con ingest (`producer`, `embed-index`, chat semántico).
 * Referencia única para documentación y futuros consumidores (MCP, scripts).
 */

/** Nodos que embed-index puede vectorizar (propiedad configurable vía embedding_spaces, típicamente `embedding`). */
export const FALKOR_EMBEDDABLE_NODE_LABELS = [
  'Function',
  'Component',
  'Document',
  'StorybookDoc',
  'MarkdownDoc',
  /** Prisma (`prisma-extract`) + TypeORM (`@Entity` en parser). */
  'Model',
  /** Prisma enums (`prisma-extract`). */
  'Enum',
  /** CSS/HTML y assets estáticos indexados. */
  'StaticAsset',
  /** Contratos HTTP OpenAPI / Strapi documentation plugin. */
  'OpenApiOperation',
  /** NestJS HTTP routes (semantic search). */
  'NestRoute',
  /** NestJS controllers (semantic search). */
  'NestController',
  /** Content-types Strapi v4 (`schema.json`). */
  'StrapiContentType',
  /** Rutas REST Strapi (`routes.json`, core router inferido). */
  'StrapiRoute',
] as const;

export type FalkorEmbeddableLabel = (typeof FALKOR_EMBEDDABLE_NODE_LABELS)[number];

/** Documentación en grafo (Fase 4): MDX/MD Storybook y markdown de proyecto. */
export const FALKOR_DOCUMENTATION_DOC_LABELS = ['StorybookDoc', 'MarkdownDoc'] as const;

export type FalkorDocumentationDocLabel = (typeof FALKOR_DOCUMENTATION_DOC_LABELS)[number];
