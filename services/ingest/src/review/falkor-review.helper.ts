/**
 * @fileoverview Helper para consultar el grafo Ariadne (FalkorDB) desde el Review Engine.
 * Cliente compartido + semáforo (evita Max pending queries / crash por socket sin listener).
 */
import { FalkorDB } from 'falkordb';
import {
  getFalkorConfig,
  GRAPH_NAME,
  isProjectShardingEnabled,
  graphNameForProject,
} from 'ariadne-common';
import { LegacyImpact } from './types';
import { AsyncSemaphore } from '../pipeline/async-semaphore';

type FalkorClient = Awaited<ReturnType<typeof FalkorDB.connect>>;

let sharedClient: FalkorClient | null = null;
let connecting: Promise<FalkorClient> | null = null;
const impactSemaphore = new AsyncSemaphore(4);

async function getSharedClient(): Promise<FalkorClient | null> {
  const config = getFalkorConfig();
  if (!config.host) return null;
  if (sharedClient) return sharedClient;
  if (connecting) return connecting;
  connecting = (async () => {
    const c = await FalkorDB.connect({
      pingInterval: 30_000,
      socket: {
        host: config.host,
        port: config.port,
        ...({
          reconnectStrategy: (retries: number) => {
            if (retries > 100) return new Error('[ingest-review] FalkorDB reconnection limit exceeded');
            return Math.min(retries * 50, 2_000);
          },
        } as object),
      },
    });
    c.on('error', (err: Error) => {
      console.error('[ingest-review] FalkorDB client error:', err?.message ?? err);
    });
    sharedClient = c;
    return c;
  })();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

/**
 * Consulta el impacto legacy de un nombre de nodo (componente, función, hook, modelo).
 */
export async function queryLegacyImpact(
  nodeName: string,
  projectId?: string,
): Promise<LegacyImpact> {
  return impactSemaphore.run(async () => {
    try {
      const client = await getSharedClient();
      if (!client) {
        return { dependents: 0, files: [], breakingRisk: 'low' };
      }
      const allDependents = new Map<string, string>();
      const graphNames = resolveGraphNames(projectId);

      for (const gName of graphNames) {
        const graph = client.selectGraph(gName);
        const params: Record<string, string> = { nodeName };

        const whereClauses: string[] = [];
        if (projectId) {
          params.projectId = projectId;
          whereClauses.push(
            '(n.projectId = $projectId OR n.projectId IS NULL)',
            '(dependent.projectId = $projectId OR dependent.projectId IS NULL)',
          );
        }
        const whereStr = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

        const q = `MATCH (n {name: $nodeName})<-[:CALLS|RENDERS|IMPORTS*]-(dependent)${whereStr} RETURN dependent.name AS name, labels(dependent) AS labels LIMIT 50`;
        const result = (await graph.query(q, { params })) as { data?: unknown[][] };
        const rows = result.data ?? [];

        for (const row of rows) {
          const name = String(row[0] ?? '');
          if (name && !allDependents.has(name)) {
            allDependents.set(name, String(row[1] ?? ''));
          }
        }

        if (!projectId) {
          const hookQ = `MATCH (h:Hook {name: $nodeName})<-[:USES_HOOK]-(consumer:Component) RETURN consumer.name AS name, labels(consumer) AS labels LIMIT 20`;
          const hookResult = (await graph.query(hookQ, { params })) as { data?: unknown[][] };
          for (const row of hookResult.data ?? []) {
            const name = String(row[0] ?? '');
            if (name && !allDependents.has(name)) {
              allDependents.set(name, String(row[1] ?? ''));
            }
          }
        }
      }

      const files = Array.from(allDependents.keys()).slice(0, 20);
      const count = allDependents.size;

      return {
        dependents: count,
        files,
        breakingRisk: count > 10 ? 'high' : count > 3 ? 'medium' : 'low',
      };
    } catch {
      return { dependents: 0, files: [], breakingRisk: 'low' };
    }
  });
}

function resolveGraphNames(projectId?: string): string[] {
  if (isProjectShardingEnabled() && projectId) {
    return [graphNameForProject(projectId)];
  }
  return [GRAPH_NAME];
}

/**
 * Impacto legacy para varios nombres — secuencial por lotes (no Promise.all masivo).
 */
export async function queryBatchLegacyImpact(
  nodeNames: string[],
  projectId?: string,
): Promise<Map<string, LegacyImpact>> {
  const map = new Map<string, LegacyImpact>();
  const batchSize = 4;
  for (let i = 0; i < nodeNames.length; i += batchSize) {
    const batch = nodeNames.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (name) => {
        const impact = await queryLegacyImpact(name, projectId);
        return { name, impact };
      }),
    );
    for (const r of results) map.set(r.name, r.impact);
  }
  return map;
}
