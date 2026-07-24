/**
 * Parse The Forge GET /projects (or similar) payloads into row objects.
 */
export function extractForgeProjectRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body.filter(
      (row): row is Record<string, unknown> => row != null && typeof row === 'object' && !Array.isArray(row),
    );
  }
  if (!body || typeof body !== 'object') return [];
  const root = body as Record<string, unknown>;
  for (const key of ['projects', 'data', 'items', 'results']) {
    const nested = root[key];
    if (Array.isArray(nested)) {
      return nested.filter(
        (row): row is Record<string, unknown> => row != null && typeof row === 'object' && !Array.isArray(row),
      );
    }
  }
  return [];
}

/** Detect accidental call to Ariadne ingest GET /projects (multi-root), not The Forge. */
export function isLikelyAriadneProjectList(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;
  return rows.every(
    (row) =>
      Array.isArray(row.repositories) &&
      !('projectType' in row) &&
      !('project_type' in row) &&
      !('stages' in row),
  );
}

const FORGE_LEGACY_TYPE_TOKENS = new Set(['LEGACY', 'BROWNFIELD', 'BROWN_FIELD']);

export function readForgeProjectType(row: Record<string, unknown>): string {
  const raw = row.projectType ?? row.project_type ?? row.type ?? row.kind ?? row.category ?? '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

/** Workshop LEGACY row (UI tag "Legacy"). Not Ariadne multi-root ids from GET /theforge/projects. */
export function isForgeLegacyProject(row: Record<string, unknown>): boolean {
  const type = readForgeProjectType(row);
  if (FORGE_LEGACY_TYPE_TOKENS.has(type)) return true;
  if (type.includes('LEGACY') || type.includes('BROWNFIELD')) return true;

  if (row.isLegacy === true || row.is_legacy === true) return true;

  const stages = row.stages;
  if (Array.isArray(stages)) {
    for (const stage of stages) {
      if (stage && typeof stage === 'object' && (stage as Record<string, unknown>).isLegacy === true) {
        return true;
      }
    }
  }
  return false;
}

/** GET /theforge/projects — proyectos indexados Ariadne (roots[]), no Workshop LEGACY. */
export function isForgeAriadneIndexedProjectList(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;
  return rows.every(
    (row) =>
      Array.isArray(row.roots) &&
      !Array.isArray(row.repositories) &&
      !('projectType' in row) &&
      !('project_type' in row) &&
      !('stages' in row),
  );
}

export function readForgeProjectId(row: Record<string, unknown>): string {
  return String(row.id ?? row.projectId ?? row.project_id ?? '').trim();
}

export function readForgeProjectName(row: Record<string, unknown>): string {
  const name = String(row.name ?? row.projectName ?? row.project_name ?? 'Sin nombre').trim();
  return name || 'Sin nombre';
}

export function readForgeGroupName(row: Record<string, unknown>): string | null {
  const g = row.groupName ?? row.group_name;
  return typeof g === 'string' && g.trim() ? g.trim() : null;
}
