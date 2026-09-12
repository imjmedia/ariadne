import { createHash } from 'node:crypto';

/** Hash estable del modelo C4 (sin generatedAt). */
export function hashC4ModelPayload(payload: {
  projectId: string;
  repoId?: string;
  level: string;
  elements: unknown[];
  relationships: unknown[];
}): string {
  const canonical = JSON.stringify({
    projectId: payload.projectId,
    repoId: payload.repoId ?? null,
    level: payload.level,
    elements: payload.elements,
    relationships: payload.relationships,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
