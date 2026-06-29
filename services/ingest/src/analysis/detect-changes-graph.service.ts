/**
 * Falkor graph queries for detect-changes blast radius.
 */
import { Injectable } from '@nestjs/common';
import { FalkorDB } from 'falkordb';
import { getFalkorConfig, graphNameForProject, isProjectShardingEnabled } from '../pipeline/falkor';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class DetectChangesGraphService {
  constructor(private readonly projects: ProjectsService) {}

  async batchDependentCounts(
    projectId: string,
    symbolNames: string[],
    repoId?: string,
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (symbolNames.length === 0) return counts;

    const config = getFalkorConfig();
    const client = await FalkorDB.connect({
      socket: { host: config.host, port: config.port },
    });

    try {
      const contexts = await this.projects.getCypherShardContexts(projectId);
      const shards =
        contexts.length > 0
          ? contexts
          : [
              {
                graphName: graphNameForProject(isProjectShardingEnabled() ? projectId : undefined),
                cypherProjectId: projectId,
              },
            ];

      for (const name of symbolNames) {
        let total = 0;
        for (const shard of shards) {
          const graph = client.selectGraph(shard.graphName);
          const whereParts = [
            '(n.projectId = $projectId OR n.projectId IS NULL)',
            '(dep.projectId = $projectId OR dep.projectId IS NULL)',
          ];
          if (repoId) {
            whereParts.push('(n.repoId = $repoId OR n.repoId IS NULL)');
            whereParts.push('(dep.repoId = $repoId OR dep.repoId IS NULL)');
          }
          const countQ = `MATCH (n {name: $nodeName})<-[:CALLS|RENDERS|IMPORTS*]-(dep) WHERE ${whereParts.join(' AND ')} RETURN count(dep) AS cnt`;
          const params: Record<string, string> = {
            nodeName: name,
            projectId: shard.cypherProjectId,
          };
          if (repoId) params.repoId = repoId;
          const res = (await graph.query(countQ, { params })) as {
            data?: Array<Record<string, unknown>>;
          };
          const first = (res.data ?? [])[0] as Record<string, unknown> | undefined;
          const val = first?.cnt;
          total += typeof val === 'number' ? val : parseInt(String(val ?? '0'), 10) || 0;
        }
        counts.set(name, total);
      }
    } finally {
      await client.close();
    }

    return counts;
  }
}
