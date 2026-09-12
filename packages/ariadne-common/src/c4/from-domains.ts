import { hashC4ModelPayload } from './content-hash.js';
import type { C4Element, C4Model, C4Relationship } from './c4-model.types.js';

export interface C4ContextDomainRef {
  id: string;
  name: string;
  description?: string | null;
}

export interface C4ContextRepoRef {
  id: string;
  label: string;
}

export interface C4ContextDependency {
  dependencyId: string;
  domainId: string;
  domainName: string;
  connectionType: string;
  description?: string | null;
}

export interface C4ContextVisibilityEdge {
  edgeId: string;
  toDomainId: string;
  toDomainName: string;
  description?: string | null;
}

/** Entrada determinista para C4 Context (dominios + whitelist + multi-root). */
export interface C4ContextSpec {
  projectId: string;
  projectName: string;
  domain?: C4ContextDomainRef | null;
  repos: C4ContextRepoRef[];
  dependencies: C4ContextDependency[];
  visibilityEdges: C4ContextVisibilityEdge[];
}

function stableId(prefix: string, raw: string): string {
  return `${prefix}_${raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
}

function externalDomainId(domainId: string): string {
  return stableId('ext', domainId);
}

function systemIdForRepo(repoId: string): string {
  return stableId('sys', repoId);
}

function ensureExternal(
  elements: C4Element[],
  seen: Set<string>,
  domain: { id: string; name: string; description?: string | null },
  reason: string,
  evidenceId?: string,
): string {
  const id = externalDomainId(domain.id);
  if (!seen.has(id)) {
    seen.add(id);
    elements.push({
      id,
      kind: 'external',
      name: domain.name,
      description: domain.description?.trim() || undefined,
      evidence: [
        {
          source: 'domain',
          nodeId: evidenceId ?? domain.id,
          reason,
        },
      ],
    });
  }
  return id;
}

/**
 * Convierte gobierno de dominios (project.domainId, whitelist, visibilidad) en C4Model nivel context.
 */
export function domainContextSpecToC4Model(spec: C4ContextSpec): C4Model {
  const elements: C4Element[] = [];
  const relationships: C4Relationship[] = [];
  const seen = new Set<string>();
  const systemIds: string[] = [];

  const domainNote = spec.domain
    ? `Dominio: ${spec.domain.name}${spec.domain.description ? ` — ${spec.domain.description}` : ''}`
    : undefined;

  if (spec.repos.length > 0) {
    for (const repo of spec.repos) {
      const id = systemIdForRepo(repo.id);
      systemIds.push(id);
      elements.push({
        id,
        kind: 'system',
        name: repo.label,
        description: domainNote,
        repoId: repo.id,
        evidence: [
          {
            source: 'domain',
            nodeId: spec.projectId,
            reason: `Sistema software (repo ${repo.label})`,
          },
        ],
      });
    }
  } else {
    const id = stableId('sys', spec.projectId);
    systemIds.push(id);
    elements.push({
      id,
      kind: 'system',
      name: spec.projectName,
      description: domainNote,
      evidence: [
        {
          source: 'domain',
          nodeId: spec.projectId,
          reason: 'Sistema software del proyecto',
        },
      ],
    });
  }

  const externalByDomain = new Map<string, string>();

  for (const dep of spec.dependencies) {
    const extId = ensureExternal(
      elements,
      seen,
      {
        id: dep.domainId,
        name: dep.domainName,
        description: dep.description,
      },
      `Whitelist project_domain_dependencies (${dep.connectionType})`,
      dep.dependencyId,
    );
    externalByDomain.set(dep.domainId, extId);

    for (const sysId of systemIds) {
      relationships.push({
        id: `${sysId}_dep_${stableId('d', dep.dependencyId)}`,
        from: sysId,
        to: extId,
        label: dep.description?.trim() || dep.domainName,
        protocol: dep.connectionType,
        evidence: [
          {
            source: 'domain',
            nodeId: dep.dependencyId,
            reason: `Dependencia hacia dominio ${dep.domainName}`,
          },
        ],
      });
    }
  }

  for (const edge of spec.visibilityEdges) {
    const extId = ensureExternal(
      elements,
      seen,
      {
        id: edge.toDomainId,
        name: edge.toDomainName,
        description: edge.description,
      },
      'Visibilidad entre dominios (domain_domain_visibility)',
      edge.edgeId,
    );
    externalByDomain.set(edge.toDomainId, extId);

    for (const sysId of systemIds) {
      const relId = `${sysId}_vis_${stableId('v', edge.edgeId)}`;
      if (relationships.some((r) => r.id === relId)) continue;
      relationships.push({
        id: relId,
        from: sysId,
        to: extId,
        label: edge.description?.trim() || 'visibilidad de dominio',
        evidence: [
          {
            source: 'domain',
            nodeId: edge.edgeId,
            reason: `Visibilidad hacia dominio ${edge.toDomainName}`,
          },
        ],
      });
    }
  }

  const contentHash = hashC4ModelPayload({
    projectId: spec.projectId,
    level: 'context',
    elements,
    relationships,
  });

  return {
    schemaVersion: '1.0',
    projectId: spec.projectId,
    level: 'context',
    generatedAt: new Date().toISOString(),
    generator: 'sync',
    contentHash,
    systemName: spec.projectName,
    elements,
    relationships,
  };
}
