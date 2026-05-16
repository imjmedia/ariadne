/**
 * @fileoverview Helper para consultar el grafo Ariadne (FalkorDB) desde el Review Engine.
 * Implementa lazy connect: la conexión se abre bajo demanda y se cierra tras la consulta.
 * Reutiliza las mismas configs de ariadne-common que el resto del sistema.
 */
import { FalkorDB } from 'falkordb';
import {
  getFalkorConfig,
  GRAPH_NAME,
  isProjectShardingEnabled,
  graphNameForProject,
  listGraphNamesForProjectRouting,
} from 'ariadne-common';
import { LegacyImpact } from './types';

/**
 * Consulta el impacto legacy de un nombre de nodo (componente, función, hook, modelo).
 * @param nodeName - Nombre del nodo a consultar.
 * @param projectId - UUID del proyecto Ariadne (opcional, para filtrar).
 * @returns Información de impacto legacy.
 */
export async function queryLegacyImpact(
  nodeName: string,
  projectId?: string,
): Promise<LegacyImpact> {
  const config = getFalkorConfig();
  if (!config.host) {
    return { dependents: 0, files: [], breakingRisk: 'low' };
  }

  try {
    const client = await FalkorDB.connect({
      socket: { host: config.host, port: config.port },
    });
    try {
      const allDependents = new Map<string, string>();
      const graphNames = resolveGraphNames(projectId);

      for (const gName of graphNames) {
        const graph = client.selectGraph(gName);
        const params: Record<string, string> = { nodeName };

        // Construir WHERE dinámico
        const whereClauses: string[] = [];
        if (projectId) {
          params.projectId = projectId;
          whereClauses.push(
            '(n.projectId = $projectId OR n.projectId IS NULL)',
            '(dependent.projectId = $projectId OR dependent.projectId IS NULL)',
          );
        }
        const whereStr = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

        // Query principal: dependientes directos (CALLS, RENDERS, IMPORTS)
        const q = `MATCH (n {name: $nodeName})<-[:CALLS|RENDERS|IMPORTS*]-(dependent)${whereStr} RETURN dependent.name AS name, labels(dependent) AS labels LIMIT 50`;
        const result = await graph.query(q, { params }) as { data?: unknown[][] };
        const rows = result.data ?? [];

        for (const row of rows) {
          const name = String(row[0] ?? '');
          if (name && !allDependents.has(name)) {
            allDependents.set(name, String(row[1] ?? ''));
          }
        }

        // Query adicional: hooks usados por componentes
        if (!projectId) {
          const hookQ = `MATCH (h:Hook {name: $nodeName})<-[:USES_HOOK]-(consumer:Component) RETURN consumer.name AS name, labels(consumer) AS labels LIMIT 20`;
          const hookResult = await graph.query(hookQ, { params }) as { data?: unknown[][] };
          for (const row of (hookResult.data ?? [])) {
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
    } finally {
      await client.close();
    }
  } catch (err) {
    // Falkor no disponible — retornar sin impacto
    return { dependents: 0, files: [], breakingRisk: 'low' };
  }
}

/**
 * Resuelve los nombres de los grafos Falkor a consultar.
 * Con sharding: todos los shards del proyecto. Sin sharding: el grafo principal.
 */
function resolveGraphNames(projectId?: string): string[] {
  if (isProjectShardingEnabled() && projectId) {
    return [graphNameForProject(projectId)];
  }
  if (isProjectShardingEnabled() && !projectId) {
    return [GRAPH_NAME];
  }
  return [GRAPH_NAME];
}

/**
 * Consulta el impacto legacy para MÚLTIPLES nombres de nodo.
 * Útil cuando un diff modifica varios archivos — ejecuta en paralelo.
 */
export async function queryBatchLegacyImpact(
  nodeNames: string[],
  projectId?: string,
): Promise<Map<string, LegacyImpact>> {
  const results = await Promise.allSettled(
    nodeNames.map(async (name) => {
      const impact = await queryLegacyImpact(name, projectId);
      return { name, impact };
    }),
  );

  const map = new Map<string, LegacyImpact>();
  for (const r of results) {
    if (r.status === 'fulfilled') {
      map.set(r.value.name, r.value.impact);
    }
  }
  return map;
}
