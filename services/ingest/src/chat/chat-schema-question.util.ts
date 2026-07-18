/**
 * Detección de intención de esquema (ariadne-common) + Cypher determinista para FalkorDB.
 * Import directo del módulo util (evita cargar logger/pino vía barrel de ariadne-common en tests).
 */
export {
  SCHEMA_MODEL_SOURCES,
  wantsArchitectureDomainQuestion,
  wantsReengineeringQuestion,
  wantsSchemaDatabaseQuestion,
} from 'ariadne-common/dist/chat-schema-question.util.js';

/** Aligned with `SCHEMA_MODEL_SOURCES` in ariadne-common. */
const PERSISTENCE_MODEL_SOURCES = ['prisma', 'typeorm'] as const;
const SCHEMA_SOURCES_CYPHER = PERSISTENCE_MODEL_SOURCES.map((s) => `'${s}'`).join(', ');

/** `:Model` de esquema real (Prisma/TypeORM/SQL), excluye DTOs heurísticos del frontend. */
export function schemaOrmModelsCypher(limit: number): string {
  return `MATCH (m:Model)
WHERE m.projectId = $projectId AND m.source IN [${SCHEMA_SOURCES_CYPHER}]
AND NOT (m.path CONTAINS '/migrations/' OR m.path CONTAINS '/migration/')
RETURN m.name AS name, m.source AS source, m.path AS path, coalesce(m.fieldSummary, '') AS fieldSummary, coalesce(m.tableName, '') AS tableName, coalesce(m.repoId, m.projectId) AS repoId
ORDER BY m.source, m.name
LIMIT ${limit}`;
}

export function schemaOrmModelRelationsCypher(limit: number): string {
  return `MATCH (a:Model)-[r:RELATES_TO]->(b:Model)
WHERE a.projectId = $projectId AND b.projectId = $projectId AND a.source IN [${SCHEMA_SOURCES_CYPHER}]
RETURN a.name AS fromEntity, b.name AS toEntity, coalesce(r.field, '') AS field, coalesce(a.repoId, a.projectId) AS repoId
ORDER BY a.name, b.name
LIMIT ${limit}`;
}

export function schemaEnumsCypher(limit: number): string {
  return `MATCH (e:Enum)
WHERE e.projectId = $projectId
RETURN e.name AS name, e.path AS path, coalesce(e.repoId, e.projectId) AS repoId
ORDER BY e.name
LIMIT ${limit}`;
}

export function schemaStrapiContentTypesCypher(limit: number): string {
  return `MATCH (ct:StrapiContentType)
WHERE ct.projectId = $projectId
RETURN ct.name AS name, coalesce(ct.strapiUid, '') AS strapiUid, coalesce(ct.kind, '') AS kind, coalesce(ct.attributesSummary, '') AS attributesSummary, ct.path AS path, coalesce(ct.repoId, ct.projectId) AS repoId
ORDER BY ct.name
LIMIT ${limit}`;
}

export function schemaStrapiRelationsCypher(limit: number): string {
  return `MATCH (a:StrapiContentType)-[r:RELATES_TO]->(b:StrapiContentType)
WHERE a.projectId = $projectId AND b.projectId = $projectId
RETURN a.name AS fromEntity, b.name AS toEntity, coalesce(r.attribute, '') AS attribute, coalesce(r.relation, '') AS relation, coalesce(a.repoId, a.projectId) AS repoId
ORDER BY a.name, b.name
LIMIT ${limit}`;
}
