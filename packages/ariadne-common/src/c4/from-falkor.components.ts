import { createHash } from 'node:crypto';
import { hashC4ModelPayload } from './content-hash.js';
import type { C4Element, C4Model, C4Relationship } from './c4-model.types.js';

export interface C4ComponentGraphNode {
  id: string;
  name: string;
  filePath: string;
  containerKey: string;
  repoId?: string;
  nodeKind: 'component' | 'route';
}

export interface C4ComponentGraphEdge {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  relType: 'RENDERS' | 'IMPORTS' | 'CALLS' | 'ROUTE_TO_COMPONENT';
}

export interface C4ComponentBuildInput {
  projectId: string;
  containerKey: string;
  containerName: string;
  pathPrefixes: string[];
  repoId?: string;
  nodes: C4ComponentGraphNode[];
  edges: C4ComponentGraphEdge[];
}

/** ID estable y único para Archify (evita colisiones al truncar paths largos). */
export function compElementId(nodeId: string): string {
  const hash = createHash('sha256').update(nodeId).digest('hex').slice(0, 10);
  const sanitized = nodeId.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 28);
  return `cmp_${sanitized}_${hash}`;
}

/**
 * Convierte subgrafo Falkor (componentes + RENDERS/IMPORTS/CALLS/rutas) en C4Model nivel component.
 */
export function falkorSubgraphToC4ComponentModel(input: C4ComponentBuildInput): C4Model {
  const containerId = `ctr_${input.containerKey.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32)}`;
  const elements: C4Element[] = [
    {
      id: containerId,
      kind: 'container',
      name: input.containerName,
      containerKey: input.containerKey,
      repoId: input.repoId,
      evidence: [
        {
          source: 'falkor',
          reason: `Container ${input.containerKey} (${input.pathPrefixes.join(', ')})`,
        },
      ],
    },
  ];

  const relationships: C4Relationship[] = [];

  for (const node of input.nodes) {
    const elId = compElementId(node.id);
    elements.push({
      id: elId,
      kind: node.nodeKind === 'route' ? 'component' : 'component',
      name: node.name,
      containerKey: input.containerKey,
      repoId: node.repoId ?? input.repoId,
      technology: node.nodeKind === 'route' ? 'Route' : undefined,
      evidence: [
        {
          source: 'falkor',
          nodeId: node.id,
          filePath: node.filePath,
          reason:
            node.nodeKind === 'route'
              ? 'Ruta web indexada (ROUTE_TO_COMPONENT)'
              : 'Componente indexado en Falkor',
        },
      ],
    });
    relationships.push({
      id: `${containerId}_has_${elId}`,
      from: containerId,
      to: elId,
      label: 'contains',
      evidence: [{ source: 'falkor', filePath: node.filePath, reason: 'CONTAINS' }],
    });
  }

  const nodeIds = new Set(input.nodes.map((n) => compElementId(n.id)));
  const rawToEl = new Map(input.nodes.map((n) => [n.id, compElementId(n.id)] as const));

  for (const edge of input.edges) {
    const from = rawToEl.get(edge.fromId);
    const to = rawToEl.get(edge.toId);
    if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to)) continue;
    relationships.push({
      id: edge.id,
      from,
      to,
      label: edge.label,
      protocol: edge.relType,
      evidence: [
        {
          source: 'falkor',
          reason: `Relación ${edge.relType} en subgrafo acotado`,
        },
      ],
    });
  }

  const contentHash = hashC4ModelPayload({
    projectId: input.projectId,
    repoId: input.repoId,
    level: 'component',
    elements,
    relationships,
  });

  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    repoId: input.repoId,
    level: 'component',
    generatedAt: new Date().toISOString(),
    generator: 'sync',
    contentHash,
    systemName: input.containerName,
    elements,
    relationships,
  };
}
