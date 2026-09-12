import { hashC4ModelPayload } from './content-hash.js';
import type { C4Element, C4Model, C4Relationship } from './c4-model.types.js';

export type C4ContainerKind = 'software' | 'database' | 'external';

export interface C4ContainerSpec {
  key: string;
  name: string;
  pathPrefixes: string[];
  technology?: string;
  c4Kind: C4ContainerKind;
}

export interface C4CommunicationSpec {
  fromKey: string;
  toKey: string;
  label?: string;
}

export interface C4InfrastructureSpec {
  systemName: string;
  containers: C4ContainerSpec[];
  communications?: C4CommunicationSpec[];
}

function slugId(key: string, repoId?: string): string {
  const base = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return repoId ? `${repoId.slice(0, 8)}_${base}` : base;
}

function isDiagramContainer(c: C4ContainerSpec): boolean {
  return c.key !== '_unassigned' && c.name !== 'Unassigned';
}

/**
 * Convierte especificación de infra (compose/workspaces) en C4Model nivel container.
 */
export function infrastructureSpecToC4Model(
  spec: C4InfrastructureSpec,
  projectId: string,
  opts?: { repoId?: string; composePath?: string },
): C4Model {
  const repoId = opts?.repoId;
  const systemId = slugId('system', repoId);
  const elements: C4Element[] = [
    {
      id: systemId,
      kind: 'system',
      name: spec.systemName,
      evidence: [
        {
          source: 'compose',
          filePath: opts?.composePath,
          reason: 'Sistema software inferido del repositorio indexado',
        },
      ],
    },
  ];

  const displayContainers = spec.containers.filter(isDiagramContainer);
  for (const c of displayContainers) {
    elements.push({
      id: slugId(c.key, repoId),
      kind: 'container',
      name: c.name,
      technology: c.technology,
      containerKey: c.key,
      repoId,
      evidence: [
        {
          source: 'compose',
          filePath: opts?.composePath,
          reason: `Container ${c.c4Kind} (${c.key})`,
        },
      ],
    });
  }

  const relationships: C4Relationship[] = [];
  for (const c of displayContainers) {
    relationships.push({
      id: `${systemId}_has_${slugId(c.key, repoId)}`,
      from: systemId,
      to: slugId(c.key, repoId),
      label: 'contains',
      evidence: [{ source: 'compose', reason: 'HAS_CONTAINER' }],
    });
  }

  for (const comm of spec.communications ?? []) {
    const from = slugId(comm.fromKey, repoId);
    const to = slugId(comm.toKey, repoId);
    if (!elements.some((e) => e.id === from) || !elements.some((e) => e.id === to)) continue;
    relationships.push({
      id: `${from}_to_${to}`,
      from,
      to,
      label: comm.label ?? 'uses',
      protocol: comm.label,
      evidence: [{ source: 'compose', filePath: opts?.composePath, reason: 'depends_on / compose' }],
    });
  }

  const contentHash = hashC4ModelPayload({
    projectId,
    repoId,
    level: 'container',
    elements,
    relationships,
  });

  return {
    schemaVersion: '1.0',
    projectId,
    repoId,
    level: 'container',
    generatedAt: new Date().toISOString(),
    generator: 'sync',
    contentHash,
    systemName: spec.systemName,
    elements,
    relationships,
  };
}

/** Fusiona varios C4Model container (multi-root) en uno por proyecto. */
export function mergeC4ContainerModels(models: C4Model[], projectId: string): C4Model {
  const elements: C4Element[] = [];
  const relationships: C4Relationship[] = [];
  const seen = new Set<string>();

  for (const m of models) {
    for (const el of m.elements) {
      if (seen.has(el.id)) continue;
      seen.add(el.id);
      elements.push(el);
    }
    for (const rel of m.relationships) {
      const rid = `${rel.from}::${rel.to}::${rel.label ?? ''}`;
      if (seen.has(rid)) continue;
      seen.add(rid);
      relationships.push({ ...rel, id: `${m.repoId ?? 'r'}_${rel.id}` });
    }
  }

  const contentHash = hashC4ModelPayload({
    projectId,
    level: 'container',
    elements,
    relationships,
  });

  return {
    schemaVersion: '1.0',
    projectId,
    level: 'container',
    generatedAt: new Date().toISOString(),
    generator: 'sync',
    contentHash,
    elements,
    relationships,
  };
}
