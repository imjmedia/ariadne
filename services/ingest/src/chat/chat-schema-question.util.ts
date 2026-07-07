/**
 * Detección de intención "esquema/diagrama de base de datos" y Cypher determinista para
 * recuperar el esquema real indexado (Prisma/TypeORM `:Model` con `source`, `:Enum`,
 * `:StrapiContentType` + relaciones `RELATES_TO`).
 *
 * Motivación: preguntas como "diagrama de base de datos que debería quedar" recuperaban
 * DTOs del frontend (`src/Models/*.tsx`) en vez del esquema de persistencia. Este módulo
 * provee un fast-path que va directo a los nodos de esquema, ignorando modelos heurísticos
 * del frontend (`m.source` fuera de `prisma`/`typeorm`).
 */

/** Fuentes de `:Model` que representan esquema de persistencia real (no DTOs del frontend). */
export const SCHEMA_MODEL_SOURCES = ['prisma', 'typeorm'] as const;

/**
 * true si el mensaje pide el esquema/diagrama/estructura de la base de datos.
 * Diseñado para minimizar falsos positivos: exige emparejar un sustantivo de BD
 * con un término de esquema/diagrama, o una frase fuerte explícita.
 */
export function wantsSchemaDatabaseQuestion(message: string): boolean {
  const t = (message ?? '').trim();
  if (!t) return false;
  const m = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Frases fuertes: por sí solas bastan.
  const strongPhrase =
    /\bdiagrama\s+(de\s+)?(base\s+de\s+datos|bd|entidad(?:es)?[- ]relacion|er\b|e-?r\b)/.test(m) ||
    /\b(esquema|estructura|modelo)\s+(de\s+)?(la\s+)?(base\s+de\s+datos|bd)\b/.test(m) ||
    /\bmodelo\s+de\s+datos\b/.test(m) ||
    /\bmodelo\s+entidad[- ]relacion\b/.test(m) ||
    /\b(database|db)\s+(schema|diagram|model|erd?)\b/.test(m) ||
    /\bentity[- ]relationship\b/.test(m) ||
    /\berd\b/.test(m) ||
    /\bcontent[- ]?types?\b/.test(m);

  if (strongPhrase) return true;

  // Emparejamiento: sustantivo de BD + término de esquema/estructura.
  const dbNoun =
    /\bbase\s+de\s+datos\b/.test(m) ||
    /\bbd\b/.test(m) ||
    /\bdatabase\b/.test(m) ||
    /\bprisma\b/.test(m) ||
    /\btypeorm\b/.test(m) ||
    /\bstrapi\b/.test(m);

  const schemaTerm =
    /\besquema\b/.test(m) ||
    /\bdiagrama\b/.test(m) ||
    /\bestructura\b/.test(m) ||
    /\bentidad(es)?\b/.test(m) ||
    /\btabla(s)?\b/.test(m) ||
    /\brelacion(es)?\b/.test(m) ||
    /\bschema\b/.test(m) ||
    /\bmigracion(es)?\b/.test(m);

  return dbNoun && schemaTerm;
}

/** `:Model` de esquema real (Prisma/TypeORM), excluye DTOs heurísticos del frontend. */
export function schemaOrmModelsCypher(limit: number): string {
  return `MATCH (m:Model)
WHERE m.projectId = $projectId AND m.source IN ['prisma', 'typeorm']
AND NOT (m.path CONTAINS '/migrations/' OR m.path CONTAINS '/migration/')
RETURN m.name AS name, m.source AS source, m.path AS path, coalesce(m.fieldSummary, '') AS fieldSummary, coalesce(m.repoId, m.projectId) AS repoId
ORDER BY m.source, m.name
LIMIT ${limit}`;
}

/** Relaciones entre modelos Prisma (`RELATES_TO {field}`). */
export function schemaOrmModelRelationsCypher(limit: number): string {
  return `MATCH (a:Model)-[r:RELATES_TO]->(b:Model)
WHERE a.projectId = $projectId AND b.projectId = $projectId AND a.source IN ['prisma', 'typeorm']
RETURN a.name AS fromEntity, b.name AS toEntity, coalesce(r.field, '') AS field, coalesce(a.repoId, a.projectId) AS repoId
ORDER BY a.name, b.name
LIMIT ${limit}`;
}

/** Enums Prisma. */
export function schemaEnumsCypher(limit: number): string {
  return `MATCH (e:Enum)
WHERE e.projectId = $projectId
RETURN e.name AS name, e.path AS path, coalesce(e.repoId, e.projectId) AS repoId
ORDER BY e.name
LIMIT ${limit}`;
}

/** Content types Strapi (esquema de persistencia del backend Strapi). */
export function schemaStrapiContentTypesCypher(limit: number): string {
  return `MATCH (ct:StrapiContentType)
WHERE ct.projectId = $projectId
RETURN ct.name AS name, coalesce(ct.strapiUid, '') AS strapiUid, coalesce(ct.kind, '') AS kind, coalesce(ct.attributesSummary, '') AS attributesSummary, ct.path AS path, coalesce(ct.repoId, ct.projectId) AS repoId
ORDER BY ct.name
LIMIT ${limit}`;
}

/** Relaciones entre content types Strapi (`RELATES_TO {attribute, relation}`). */
export function schemaStrapiRelationsCypher(limit: number): string {
  return `MATCH (a:StrapiContentType)-[r:RELATES_TO]->(b:StrapiContentType)
WHERE a.projectId = $projectId AND b.projectId = $projectId
RETURN a.name AS fromEntity, b.name AS toEntity, coalesce(r.attribute, '') AS attribute, coalesce(r.relation, '') AS relation, coalesce(a.repoId, a.projectId) AS repoId
ORDER BY a.name, b.name
LIMIT ${limit}`;
}
