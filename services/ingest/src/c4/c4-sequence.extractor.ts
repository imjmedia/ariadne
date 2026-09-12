/**
 * @fileoverview Flujo API desde Falkor → ApiFlowSpec (ruta elegible + nombres reales del monorepo).
 */
import { Injectable, Logger } from '@nestjs/common';
import { FalkorDB } from 'falkordb';
import {
  apiFlowToArchifySequence,
  formatHttpCallLabel,
  inferMonorepoSegmentLabel,
  type ApiFlowSpec,
  type ArchifySequenceIr,
  type C4SequenceRouteOption,
} from 'ariadne-common';
import { getFalkorConfig, graphNameForProject, isProjectShardingEnabled } from '../pipeline/falkor';
import { ProjectsService } from '../projects/projects.service';

export interface C4SequenceExtractResult {
  spec: ApiFlowSpec;
  archifyIr: ArchifySequenceIr;
  routePath: string;
}

interface SequenceFlowRow {
  routePath?: string;
  screenName?: string;
  screenFilePath?: string;
  apiPath?: string;
  backendPath?: string;
  method?: string;
  handlerName?: string;
  controllerName?: string;
  controllerFilePath?: string;
  routeId?: string;
  isPublicEntry?: boolean;
  hasApiLink?: boolean;
}

@Injectable()
export class C4SequenceExtractor {
  private readonly logger = new Logger(C4SequenceExtractor.name);

  constructor(private readonly projects: ProjectsService) {}

  async listRoutes(projectId: string): Promise<C4SequenceRouteOption[]> {
    const rows = await this.fetchRouteRows(projectId);
    return rows.map((row) => this.rowToRouteOption(row));
  }

  async buildRepresentativeFlow(
    projectId: string,
    routePath?: string,
  ): Promise<C4SequenceExtractResult> {
    const rows = await this.fetchRouteRows(projectId);
    const row =
      (routePath ? rows.find((r) => r.routePath === routePath) : undefined) ??
      this.pickDefaultRoute(rows) ??
      (await this.fetchApiClientFallback(projectId));
    const spec = this.rowToSpec(projectId, row);
    const resolvedRoute = String(row?.routePath ?? routePath ?? '/');
    return {
      spec,
      archifyIr: apiFlowToArchifySequence(spec),
      routePath: resolvedRoute,
    };
  }

  private pickDefaultRoute(rows: SequenceFlowRow[]): SequenceFlowRow | undefined {
    const withApi = rows.filter((r) => r.hasApiLink);
    const publicWithApi = withApi.find((r) => r.isPublicEntry);
    if (publicWithApi) return publicWithApi;
    if (withApi[0]) return withApi[0];
    const publicRoute = rows.find((r) => r.isPublicEntry);
    if (publicRoute) return publicRoute;
    return rows[0];
  }

  private rowToRouteOption(row: SequenceFlowRow): C4SequenceRouteOption {
    const method = String(row.method ?? 'GET');
    const apiPath = row.apiPath ?? row.backendPath;
    return {
      routePath: String(row.routePath ?? '/'),
      screenName: row.screenName ? String(row.screenName) : null,
      apiSummary: apiPath ? formatHttpCallLabel(method, String(apiPath)) : null,
      isPublicEntry: Boolean(row.isPublicEntry),
      hasApiLink: Boolean(row.hasApiLink),
    };
  }

  private rowToSpec(projectId: string, row: SequenceFlowRow | null): ApiFlowSpec {
    const route = String(row?.routePath ?? '/');
    const screen = String(row?.screenName ?? 'Screen');
    const screenFile = row?.screenFilePath ? String(row.screenFilePath) : undefined;
    const method = String(row?.method ?? 'GET');
    const apiPath = row?.apiPath ? String(row.apiPath) : undefined;
    const backendPath = row?.backendPath ? String(row.backendPath) : apiPath;
    const handlerName = row?.handlerName ? String(row.handlerName) : undefined;
    const controllerName = row?.controllerName ? String(row.controllerName) : undefined;
    const controllerFile = row?.controllerFilePath ? String(row.controllerFilePath) : undefined;

    const webLabel =
      inferMonorepoSegmentLabel(screenFile, 'app') ??
      (screen !== 'Screen' ? screen : 'Web UI');
    const apiLabel =
      controllerName ??
      inferMonorepoSegmentLabel(controllerFile, 'service') ??
      'API Gateway';
    const backendLabel = handlerName ?? controllerName ?? inferMonorepoSegmentLabel(controllerFile, 'service') ?? 'Backend';
    const backendService = inferMonorepoSegmentLabel(controllerFile, 'service');
    const dbLabel =
      backendService?.toLowerCase().includes('ingest') ||
      backendService?.toLowerCase().includes('falkor')
        ? 'FalkorDB'
        : 'PostgreSQL';

    const clientCall = formatHttpCallLabel(method, apiPath ?? backendPath ?? '/api');
    const backendCall = backendPath ?? handlerName ?? 'handler';

    const title = `API flow — ${route}`;
    const steps = [
      {
        id: 'open',
        from: 'user',
        to: 'web',
        label: `navega ${route} → ${screen}`,
        variant: 'default' as const,
      },
      {
        id: 'call',
        from: 'web',
        to: 'api',
        label: clientCall,
        variant: 'emphasis' as const,
      },
      {
        id: 'handler',
        from: 'api',
        to: 'backend',
        label: backendCall,
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
      backendPath,
      method,
      participants: [
        { id: 'user', label: 'Usuario', type: 'external', sublabel: 'browser' },
        { id: 'web', label: webLabel, type: 'frontend', sublabel: screen },
        { id: 'api', label: apiLabel, type: 'backend', sublabel: 'HTTP' },
        { id: 'backend', label: backendLabel, type: 'backend', sublabel: handlerName ?? 'handler' },
        { id: 'db', label: dbLabel, type: 'database', sublabel: 'persistencia' },
      ],
      steps,
      evidence: [
        {
          source: 'falkor',
          nodeId: String(row?.routeId ?? row?.routePath ?? projectId),
          filePath: screenFile,
          reason: row?.hasApiLink
            ? 'Route + REFERENCES_API / NestRoute indexados'
            : row
              ? 'Route indexada (sin enlace API completo en el grafo)'
              : 'Flujo sintético (sin ruta indexada)',
        },
      ],
    };
  }

  private async fetchRouteRows(projectId: string): Promise<SequenceFlowRow[]> {
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

      const q = `
        MATCH (rt:Route {projectId: $projectId})
        WHERE rt.path IS NOT NULL
        MATCH (rt)-[:ROUTE_TO_COMPONENT]->(comp:Component)
        MATCH (sf:File)-[:CONTAINS]->(comp)
        OPTIONAL MATCH (rt)-[:ENTRY_REACHES_API]->(acr:ApiClientReference)
        OPTIONAL MATCH (acr)-[:CALLS_NEST_ROUTE]->(nr:NestRoute)
        OPTIONAL MATCH (acr)-[:CALLS_API]->(op:OpenApiOperation)-[:SAME_REST_AS]->(nr2:NestRoute)
        WITH rt, comp, sf, acr, op, coalesce(nr, nr2) AS nr
        OPTIONAL MATCH (nc:NestController)-[:DECLARES_ROUTE]->(nr)
        OPTIONAL MATCH (cf:File)-[:CONTAINS]->(nc)
        RETURN rt.path AS routePath,
               comp.name AS screenName,
               sf.path AS screenFilePath,
               coalesce(acr.normalizedPath, acr.apiPath) AS apiPath,
               coalesce(nr.fullPath, nr.path) AS backendPath,
               coalesce(nr.httpMethod, op.method, 'GET') AS method,
               nr.handlerName AS handlerName,
               coalesce(nc.name, nr.controllerName) AS controllerName,
               cf.path AS controllerFilePath,
               rt.path AS routeId,
               coalesce(rt.isPublicEntry, 'false') AS isPublicEntry,
               (acr IS NOT NULL AND nr IS NOT NULL) AS hasApiLink
        ORDER BY
          CASE WHEN coalesce(rt.isPublicEntry, 'false') = 'true' THEN 0 ELSE 1 END,
          CASE WHEN acr IS NOT NULL AND nr IS NOT NULL THEN 0 ELSE 1 END,
          rt.path
        LIMIT 80
      `;
      const res = (await graph.query(q, { params: { projectId: pid } })) as {
        data?: Array<Record<string, unknown>>;
      };
      return (res.data ?? []).map((row) => this.normalizeFlowRow(row));
    } catch (err) {
      this.logger.warn(
        `C4 sequence list routes: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    } finally {
      await client.close();
    }
  }

  private async fetchApiClientFallback(projectId: string): Promise<SequenceFlowRow | null> {
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

      const fallbackQ = `
        MATCH (f:File)-[:REFERENCES_API]->(acr:ApiClientReference)
        WHERE f.projectId = $projectId
        OPTIONAL MATCH (acr)-[:CALLS_NEST_ROUTE]->(nr:NestRoute)
        OPTIONAL MATCH (nc:NestController)-[:DECLARES_ROUTE]->(nr)
        OPTIONAL MATCH (cf:File)-[:CONTAINS]->(nc)
        RETURN f.path AS screenFilePath,
               'API client' AS screenName,
               coalesce(acr.normalizedPath, acr.apiPath) AS apiPath,
               coalesce(nr.fullPath, nr.path) AS backendPath,
               coalesce(nr.httpMethod, 'GET') AS method,
               nr.handlerName AS handlerName,
               coalesce(nc.name, nr.controllerName) AS controllerName,
               cf.path AS controllerFilePath,
               f.path AS routePath,
               true AS hasApiLink
        LIMIT 1
      `;
      const fb = (await graph.query(fallbackQ, { params: { projectId: pid } })) as {
        data?: Array<Record<string, unknown>>;
      };
      const first = fb.data?.[0];
      return first ? this.normalizeFlowRow(first) : null;
    } catch (err) {
      this.logger.warn(
        `C4 sequence extract fallback: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      await client.close();
    }
  }

  private normalizeFlowRow(row: Record<string, unknown>): SequenceFlowRow {
    return {
      routePath: row.routePath != null ? String(row.routePath) : undefined,
      screenName: row.screenName != null ? String(row.screenName) : undefined,
      screenFilePath: row.screenFilePath != null ? String(row.screenFilePath) : undefined,
      apiPath: row.apiPath != null ? String(row.apiPath) : undefined,
      backendPath: row.backendPath != null ? String(row.backendPath) : undefined,
      method: row.method != null ? String(row.method) : undefined,
      handlerName: row.handlerName != null ? String(row.handlerName) : undefined,
      controllerName: row.controllerName != null ? String(row.controllerName) : undefined,
      controllerFilePath: row.controllerFilePath != null ? String(row.controllerFilePath) : undefined,
      routeId: row.routeId != null ? String(row.routeId) : undefined,
      isPublicEntry: String(row.isPublicEntry ?? 'false') === 'true',
      hasApiLink: Boolean(row.hasApiLink),
    };
  }
}
