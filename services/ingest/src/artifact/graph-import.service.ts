/**
 * Import graph artifact from cloned repo into Falkor when local slice is empty/stale.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FalkorDB } from 'falkordb';
import * as fs from 'fs';
import { Repository } from 'typeorm';
import {
  effectiveShardMode,
  getFalkorConfig,
  graphNameForProject,
  isProjectShardingEnabled,
  listGraphNamesForProjectRouting,
} from '../pipeline/falkor';
import { ProjectEntity } from '../projects/entities/project.entity';
import type { GraphArtifactBootstrapResult } from './graph-artifact.types';
import {
  artifactPaths,
  decompressJsonl,
  parseJsonl,
  readManifest,
  verifyManifestSha256,
} from './graph-artifact-serialize';
import { importRecordsToGraph } from './graph-artifact-cypher';

export interface BootstrapFromCloneOptions {
  workDir: string;
  projectIds: string[];
  repoId: string;
  getLatestCommitSha: () => Promise<string | null>;
}

@Injectable()
export class GraphImportService {
  private readonly logger = new Logger(GraphImportService.name);

  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
  ) {}

  async tryBootstrapFromClone(opts: BootstrapFromCloneOptions): Promise<GraphArtifactBootstrapResult> {
    const paths = artifactPaths(opts.workDir, opts.repoId);
    if (!fs.existsSync(paths.artifactPath) || !fs.existsSync(paths.manifestPath)) {
      return { imported: false, reason: 'artifact_not_found' };
    }

    let manifest;
    try {
      manifest = readManifest(paths.manifestPath);
      verifyManifestSha256(manifest, paths.artifactPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Graph artifact integrity check failed: ${msg}`);
      return { imported: false, reason: 'integrity_failed' };
    }

    if (manifest.repoId !== opts.repoId) {
      return { imported: false, reason: 'repo_id_mismatch' };
    }

    const projectId = opts.projectIds.includes(manifest.projectId)
      ? manifest.projectId
      : opts.projectIds[0];
    if (!projectId) {
      return { imported: false, reason: 'no_project_id' };
    }

    const existingNodes = await this.countRepoNodes(projectId, opts.repoId);
    const stale =
      existingNodes === 0 ||
      process.env.GRAPH_ARTIFACT_FORCE_IMPORT === '1' ||
      process.env.GRAPH_ARTIFACT_FORCE_IMPORT === 'true';

    if (!stale) {
      return { imported: false, reason: 'local_graph_not_empty', nodeCount: existingNodes };
    }

    const compressed = fs.readFileSync(paths.artifactPath);
    const jsonl = await decompressJsonl(compressed);
    const records = parseJsonl(jsonl);

    const config = getFalkorConfig();
    const client = await FalkorDB.connect({
      socket: { host: config.host, port: config.port },
    });

    try {
      const graphName = graphNameForProject(isProjectShardingEnabled() ? projectId : undefined);
      const graph = client.selectGraph(graphName);
      const { nodeCount, edgeCount } = await importRecordsToGraph(graph, records);

      const headSha = await opts.getLatestCommitSha();
      const skipGraphWrite =
        !!manifest.commitSha && !!headSha && manifest.commitSha === headSha;

      this.logger.log(
        `Imported graph artifact for repo ${opts.repoId}: ${nodeCount} nodes, ${edgeCount} edges` +
          (skipGraphWrite ? ' (skip graph write — commit matches manifest)' : ''),
      );

      return {
        imported: true,
        nodeCount,
        edgeCount,
        skipGraphWrite,
        manifest,
      };
    } finally {
      await client.close();
    }
  }

  async countRepoNodes(projectId: string, repoId: string): Promise<number> {
    const config = getFalkorConfig();
    const client = await FalkorDB.connect({
      socket: { host: config.host, port: config.port },
    });

    try {
      const proj = await this.projectRepo.findOne({ where: { id: projectId } });
      const shardMode = effectiveShardMode(proj?.falkorShardMode ?? 'project');
      const segments = Array.isArray(proj?.falkorDomainSegments) ? proj!.falkorDomainSegments! : [];
      const graphNames = listGraphNamesForProjectRouting(
        projectId,
        shardMode === 'domain' ? 'domain' : 'project',
        segments,
      );
      if (graphNames.length === 0) {
        graphNames.push(graphNameForProject(isProjectShardingEnabled() ? projectId : undefined));
      }

      let total = 0;
      for (const gName of graphNames) {
        const graph = client.selectGraph(gName);
        try {
          const res = (await graph.query(
            `MATCH (n) WHERE n.projectId = $projectId AND n.repoId = $repoId RETURN count(n) AS c`,
            { params: { projectId, repoId } },
          )) as { data?: Array<{ c: number }> };
          total += res.data?.[0]?.c ?? 0;
        } catch {
          /* absent shard */
        }
      }
      return total;
    } finally {
      await client.close();
    }
  }
}
