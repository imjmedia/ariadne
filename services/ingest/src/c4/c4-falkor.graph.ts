/**
 * @fileoverview Consultas Falkor acotadas para C4 Component (multi-shard).
 */
import { Injectable, Logger } from '@nestjs/common';
import { FalkorDB } from 'falkordb';
import type { C4ComponentGraphEdge, C4ComponentGraphNode } from 'ariadne-common';
import { getFalkorConfig, graphNameForProject, isProjectShardingEnabled } from '../pipeline/falkor';
import { ProjectsService } from '../projects/projects.service';

const MAX_COMPONENTS = 48;
const MAX_EDGES = 80;

@Injectable()
export class C4FalkorGraph {
  private readonly logger = new Logger(C4FalkorGraph.name);

  constructor(private readonly projects: ProjectsService) {}

  async fetchComponentSubgraph(
    projectId: string,
    opts: {
      pathPrefixes: string[];
      containerKey: string;
      repoId?: string;
    },
  ): Promise<{ nodes: C4ComponentGraphNode[]; edges: C4ComponentGraphEdge[] }> {
    const nodes: C4ComponentGraphNode[] = [];
    const edges: C4ComponentGraphEdge[] = [];
    const nodeSeen = new Set<string>();

    const config = getFalkorConfig();
    const client = await FalkorDB.connect({
      socket: { host: config.host, port: config.port },
    });

    try {
      const contexts = await this.projects.getCypherShardContexts(projectId, {
        includeSiblingProjects: false,
      });
      const shards =
        contexts.length > 0
          ? contexts
          : [
              {
                graphName: graphNameForProject(isProjectShardingEnabled() ? projectId : undefined),
                cypherProjectId: projectId,
              },
            ];

      for (const shard of shards) {
        const graph = client.selectGraph(shard.graphName);
        const pid = shard.cypherProjectId;
        const repoClause = opts.repoId ? ' AND f.repoId = $repoId AND c.repoId = $repoId' : '';

        for (const prefix of opts.pathPrefixes) {
          if (nodes.length >= MAX_COMPONENTS) break;

          const compQ = `
            MATCH (f:File)-[:CONTAINS]->(c:Component)
            WHERE f.projectId = $projectId AND c.projectId = $projectId
              AND f.path STARTS WITH $prefix${repoClause}
            RETURN c.name AS name, f.path AS path, coalesce(c.repoId, f.repoId) AS repoId
            ORDER BY f.path, c.name
            LIMIT ${MAX_COMPONENTS}
          `;
          const compRes = (await graph.query(compQ, {
            params: { projectId: pid, prefix, repoId: opts.repoId ?? '' },
          })) as { data?: Array<Record<string, unknown>> };

          for (const row of compRes.data ?? []) {
            const name = String(row.name ?? '');
            const path = String(row.path ?? '');
            if (!name || !path) continue;
            const id = `${name}::${path}`;
            if (nodeSeen.has(id)) continue;
            nodeSeen.add(id);
            nodes.push({
              id,
              name,
              filePath: path,
              containerKey: opts.containerKey,
              repoId: row.repoId ? String(row.repoId) : opts.repoId,
              nodeKind: 'component',
            });
          }

          const routeQ = `
            MATCH (rt:Route)-[:ROUTE_TO_COMPONENT]->(c:Component)
            WHERE rt.projectId = $projectId AND c.projectId = $projectId
              AND rt.path IS NOT NULL${opts.repoId ? ' AND rt.repoId = $repoId AND c.repoId = $repoId' : ''}
            MATCH (f:File)-[:CONTAINS]->(c)
            WHERE f.path STARTS WITH $prefix
            RETURN rt.path AS routePath, c.name AS name, f.path AS path
            LIMIT 24
          `;
          const routeRes = (await graph.query(routeQ, {
            params: { projectId: pid, prefix, repoId: opts.repoId ?? '' },
          })) as { data?: Array<Record<string, unknown>> };

          for (const row of routeRes.data ?? []) {
            const routePath = String(row.routePath ?? '');
            const name = `Route ${routePath}`;
            const path = String(row.path ?? '');
            const id = `route::${routePath}::${path}`;
            if (nodeSeen.has(id)) continue;
            nodeSeen.add(id);
            nodes.push({
              id,
              name,
              filePath: path,
              containerKey: opts.containerKey,
              repoId: opts.repoId,
              nodeKind: 'route',
            });
            const compId = `${String(row.name ?? '')}::${path}`;
            if (nodeSeen.has(compId)) {
              edges.push({
                id: `route_${routePath}_to_${compId}`,
                fromId: id,
                toId: compId,
                label: routePath,
                relType: 'ROUTE_TO_COMPONENT',
              });
            }
          }
        }

        if (nodes.length === 0) continue;

        const names = [...new Set(nodes.filter((n) => n.nodeKind === 'component').map((n) => n.name))];
        if (names.length === 0) continue;

        const prefixParams: Record<string, string | string[]> = {
          projectId: pid,
          names,
          prefixes: opts.pathPrefixes,
        };

        const rendersQ = `
          MATCH (a:Component)-[:RENDERS]->(b:Component)
          WHERE a.projectId = $projectId AND b.projectId = $projectId
            AND a.name IN $names AND b.name IN $names
          MATCH (fa:File)-[:CONTAINS]->(a), (fb:File)-[:CONTAINS]->(b)
          WHERE fa.projectId = $projectId AND fb.projectId = $projectId
            AND ANY(p IN $prefixes WHERE fa.path STARTS WITH p)
            AND ANY(p IN $prefixes WHERE fb.path STARTS WITH p)
          RETURN a.name AS fromName, fa.path AS fromPath, b.name AS toName, fb.path AS toPath
          LIMIT ${MAX_EDGES}
        `;
        const rendersRes = (await graph.query(rendersQ, { params: prefixParams })) as {
          data?: Array<Record<string, unknown>>;
        };
        for (const row of rendersRes.data ?? []) {
          const fromId = `${String(row.fromName)}::${String(row.fromPath)}`;
          const toId = `${String(row.toName)}::${String(row.toPath)}`;
          if (!nodeSeen.has(fromId) || !nodeSeen.has(toId)) continue;
          edges.push({
            id: `renders_${fromId}_${toId}`,
            fromId,
            toId,
            label: 'renders',
            relType: 'RENDERS',
          });
        }

        const importsQ = `
          MATCH (fa:File)-[:IMPORTS]->(fb:File)
          WHERE fa.projectId = $projectId AND fb.projectId = $projectId
            AND ANY(p IN $prefixes WHERE fa.path STARTS WITH p)
            AND ANY(p IN $prefixes WHERE fb.path STARTS WITH p)
          MATCH (fa)-[:CONTAINS]->(a:Component), (fb)-[:CONTAINS]->(b:Component)
          RETURN a.name AS fromName, fa.path AS fromPath, b.name AS toName, fb.path AS toPath
          LIMIT ${MAX_EDGES}
        `;
        const impRes = (await graph.query(importsQ, { params: prefixParams })) as {
          data?: Array<Record<string, unknown>>;
        };
        for (const row of impRes.data ?? []) {
          const fromId = `${String(row.fromName)}::${String(row.fromPath)}`;
          const toId = `${String(row.toName)}::${String(row.toPath)}`;
          if (!nodeSeen.has(fromId) || !nodeSeen.has(toId) || fromId === toId) continue;
          edges.push({
            id: `imports_${fromId}_${toId}`,
            fromId,
            toId,
            label: 'imports',
            relType: 'IMPORTS',
          });
        }
      }
    } catch (err) {
      this.logger.warn(
        `C4 Falkor subgraph: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await client.close();
    }

    const edgeSeen = new Set<string>();
    const uniqueEdges = edges.filter((e) => {
      const k = `${e.fromId}::${e.toId}::${e.relType}`;
      if (edgeSeen.has(k)) return false;
      edgeSeen.add(k);
      return true;
    });

    return { nodes: nodes.slice(0, MAX_COMPONENTS), edges: uniqueEdges.slice(0, MAX_EDGES) };
  }
}
