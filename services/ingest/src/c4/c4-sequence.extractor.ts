/**
 * @fileoverview Flujo API representativo desde Falkor → ApiFlowSpec.
 */
import { Injectable, Logger } from '@nestjs/common';
import { FalkorDB } from 'falkordb';
import {
  apiFlowToArchifySequence,
  type ApiFlowSpec,
  type ArchifySequenceIr,
} from 'ariadne-common';
import { getFalkorConfig, graphNameForProject, isProjectShardingEnabled } from '../pipeline/falkor';
import { ProjectsService } from '../projects/projects.service';

export interface C4SequenceExtractResult {
  spec: ApiFlowSpec;
  archifyIr: ArchifySequenceIr;
}

@Injectable()
export class C4SequenceExtractor {
  private readonly logger = new Logger(C4SequenceExtractor.name);

  constructor(private readonly projects: ProjectsService) {}

  async buildRepresentativeFlow(projectId: string, routePath?: string): Promise<C4SequenceExtractResult> {
    const row = await this.fetchFlowRow(projectId, routePath);
    const spec = this.rowToSpec(projectId, row);
    return { spec, archifyIr: apiFlowToArchifySequence(spec) };
  }

  private rowToSpec(
    projectId: string,
    row: Record<string, unknown> | null,
  ): ApiFlowSpec {
    const route = String(row?.routePath ?? '/');
    const screen = String(row?.screenName ?? 'Screen');
    const apiPath = String(row?.apiPath ?? row?.backendPath ?? 'GET /api');
    const method = String(row?.method ?? 'GET');
    const backend = String(row?.backendPath ?? apiPath);

    const title = `API flow — ${route}`;
    const steps = [
      {
        id: 'open',
        from: 'user',
        to: 'web',
        label: `navega → render ${screen}`,
        variant: 'default' as const,
      },
      {
        id: 'call',
        from: 'web',
        to: 'api',
        label: `${method} ${apiPath}`,
        variant: 'emphasis' as const,
      },
      {
        id: 'handler',
        from: 'api',
        to: 'backend',
        label: backend,
        variant: 'emphasis' as const,
      },
      {
        id: 'db',
        from: 'backend',
        to: 'db',
        label: 'query',
        variant: 'dashed' as const,
      },
      {
        id: 'response',
        from: 'api',
        to: 'web',
        label: '200 JSON',
        variant: 'return' as const,
      },
    ];

    return {
      title,
      routePath: route,
      screenName: screen,
      apiPath,
      backendPath: backend,
      method,
      participants: [
        { id: 'user', label: 'Usuario', type: 'external', sublabel: 'browser' },
        { id: 'web', label: 'Web UI', type: 'frontend', sublabel: screen },
        { id: 'api', label: 'API Gateway', type: 'backend', sublabel: 'HTTP' },
        { id: 'backend', label: 'Backend', type: 'backend', sublabel: 'handler' },
        { id: 'db', label: 'Base de datos', type: 'database', sublabel: 'persistencia' },
      ],
      steps,
      evidence: [
        {
          source: 'falkor',
          nodeId: String(row?.routeId ?? projectId),
          reason: row
            ? 'Route + REFERENCES_API / NestRoute indexados'
            : 'Flujo sintético (sin ruta indexada)',
        },
      ],
    };
  }

  private async fetchFlowRow(
    projectId: string,
    routePath?: string,
  ): Promise<Record<string, unknown> | null> {
    const config = getFalkorConfig();
    const client = await FalkorDB.connect({
      socket: { host: config.host, port: config.port },
    });
    try {
      const contexts = await this.projects.getCypherShardContexts(projectId, {
        includeSiblingProjects: false,
      });
      const shard = contexts[0] ?? {
        graphName: graphNameForProject(isProjectShardingEnabled() ? projectId : undefined),
        cypherProjectId: projectId,
      };
      const graph = client.selectGraph(shard.graphName);
      const pid = shard.cypherProjectId;

      const routeFilter = routePath
        ? 'AND rt.path = $routePath'
        : `AND (coalesce(rt.isPublicEntry, 'false') = 'true' OR rt.path IS NOT NULL)`;

      const q = `
        MATCH (rt:Route {projectId: $projectId})
        WHERE rt.path IS NOT NULL ${routeFilter}
        MATCH (rt)-[:ROUTE_TO_COMPONENT]->(comp:Component)
        OPTIONAL MATCH (rt)-[:ENTRY_REACHES_API]->(acr:ApiClientReference)
        OPTIONAL MATCH (acr)-[:CALLS_NEST_ROUTE]->(nr:NestRoute)
        OPTIONAL MATCH (acr)-[:CALLS_API]->(op:OpenApiOperation)
        RETURN rt.path AS routePath, comp.name AS screenName,
               coalesce(acr.apiPath, acr.normalizedPath) AS apiPath,
               coalesce(nr.path, op.pathTemplate) AS backendPath,
               coalesce(nr.handlerName, op.method, 'GET') AS method,
               rt.path AS routeId
        ORDER BY rt.path
        LIMIT 1
      `;
      const res = (await graph.query(q, {
        params: { projectId: pid, routePath: routePath ?? '' },
      })) as { data?: Array<Record<string, unknown>> };
      const first = res.data?.[0];
      if (first) return first;

      const fallbackQ = `
        MATCH (f:File)-[:REFERENCES_API]->(acr:ApiClientReference)
        WHERE f.projectId = $projectId
        OPTIONAL MATCH (acr)-[:CALLS_NEST_ROUTE]->(nr:NestRoute)
        RETURN f.path AS routePath, 'API client' AS screenName,
               acr.apiPath AS apiPath, nr.path AS backendPath,
               coalesce(nr.handlerName, 'GET') AS method
        LIMIT 1
      `;
      const fb = (await graph.query(fallbackQ, { params: { projectId: pid } })) as {
        data?: Array<Record<string, unknown>>;
      };
      return fb.data?.[0] ?? null;
    } catch (err) {
      this.logger.warn(
        `C4 sequence extract: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      await client.close();
    }
  }
}
