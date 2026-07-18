/** Helpers to infer TypeORM schema relations for ERD (index + chat). */

export interface TypeOrmInferredRelation {
  fromEntity: string;
  toEntity: string;
  field: string;
}

export function parseModelFieldSummary(fieldSummary: unknown): string[] {
  if (Array.isArray(fieldSummary)) return fieldSummary.map(String);
  if (typeof fieldSummary === 'string' && fieldSummary.trim()) {
    try {
      const parsed = JSON.parse(fieldSummary) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return fieldSummary
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/** Lowercase hint → canonical model name (handles `Event` vs `EventEntity`). */
export function buildTypeOrmModelNameIndex(modelNames: string[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const name of modelNames) {
    index.set(name.toLowerCase(), name);
    if (name.endsWith('Entity')) {
      index.set(name.slice(0, -6).toLowerCase(), name);
    }
  }
  return index;
}

export function resolveTypeOrmModelName(hint: string, index: Map<string, string>): string | null {
  const trimmed = hint.trim();
  if (!trimmed) return null;
  const direct = index.get(trimmed.toLowerCase());
  if (direct) return direct;
  const withoutEntity = trimmed.replace(/Entity$/i, '');
  if (withoutEntity !== trimmed) {
    return index.get(withoutEntity.toLowerCase()) ?? null;
  }
  return null;
}

/** Resolve decorator target (e.g. EventEntity) to an indexed model name in the same repo. */
export function resolveTypeOrmTargetName(
  targetType: string,
  modelNames: Iterable<string>,
): string | null {
  const names = [...modelNames];
  const index = buildTypeOrmModelNameIndex(names);
  return resolveTypeOrmModelName(targetType, index);
}

/**
 * Infer FK / navigation relations from indexed TypeORM fieldSummary arrays
 * (`eventId` + `event` → Event, `userId` → User, etc.).
 */
export function inferTypeOrmRelationsFromModels(
  models: Array<{ name?: unknown; fieldSummary?: unknown }>,
): TypeOrmInferredRelation[] {
  const names = models.map((m) => String(m.name ?? '')).filter(Boolean);
  const index = buildTypeOrmModelNameIndex(names);
  const seen = new Set<string>();
  const rels: TypeOrmInferredRelation[] = [];

  for (const m of models) {
    const fromEntity = String(m.name ?? '');
    if (!fromEntity) continue;
    const fields = parseModelFieldSummary(m.fieldSummary);
    const fieldLc = new Set(fields.map((f) => f.toLowerCase()));

    for (const field of fields) {
      if (field === 'id' || field.endsWith('At')) continue;

      if (/Id$/.test(field) && field.length > 2) {
        const base = field.slice(0, -2);
        const toEntity = resolveTypeOrmModelName(base, index);
        if (toEntity && toEntity !== fromEntity) {
          const key = `${fromEntity}|${toEntity}|${field}`;
          if (!seen.has(key)) {
            seen.add(key);
            rels.push({ fromEntity, toEntity, field });
          }
        }
        continue;
      }

      const toEntity = resolveTypeOrmModelName(field, index);
      if (!toEntity || toEntity === fromEntity) continue;
      const fk = `${field}Id`;
      if (fieldLc.has(fk.toLowerCase())) {
        const key = `${fromEntity}|${toEntity}|${field}`;
        if (!seen.has(key)) {
          seen.add(key);
          rels.push({ fromEntity, toEntity, field });
        }
      }
    }
  }

  return rels;
}
