/**
 * Export Falkor subgraph (projectId + repoId) to `.ariadne/graph-<repoId>.jsonl.zst`.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { RepositoriesService } from '../repositories/repositories.service';
import { BitbucketService } from '../bitbucket/bitbucket.service';
import { GitHubService } from '../providers/github.service';
import { CredentialsService } from '../credentials/credentials.service';
import { runShallowClone } from '../providers/git-clone.provider';
import { ProjectEntity } from '../projects/entities/project.entity';
import type {
  GraphArtifactCompressionTier,
  GraphArtifactExportResult,
  GraphArtifactManifest,
} from './graph-artifact.types';
import {
  artifactFilename,
  artifactPaths,
  compressJsonl,
  ensureArtifactDir,
  ensureGitAttributesMergeOurs,
  serializeRecords,
  sha256Hex,
  writeManifest,
  zstdLevelForTier,
} from './graph-artifact-serialize';
import { recordsFromGraphQuery } from './graph-artifact-cypher';

export interface ExportGraphArtifactOptions {
  repositoryId: string;
  projectId?: string;
  tier?: GraphArtifactCompressionTier;
  workDir?: string;
  commitSha?: string | null;
  cleanupClone?: boolean;
}

@Injectable()
export class GraphExportService {
  private readonly logger = new Logger(GraphExportService.name);

  constructor(
    private readonly repos: RepositoriesService,
    private readonly bitbucket: BitbucketService,
    private readonly github: GitHubService,
    private readonly credentials: CredentialsService,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
  ) {}

  async exportGraphArtifact(opts: ExportGraphArtifactOptions): Promise<GraphArtifactExportResult> {
    const repo = await this.repos.findOne(opts.repositoryId);
    const projectId = await this.resolveProjectId(opts.repositoryId, opts.projectId);
    const tier = opts.tier ?? 'best';

    let workDir = opts.workDir;
    let cleanup: (() => void) | undefined;
    let commitSha = opts.commitSha ?? null;

    if (!workDir) {
      const cloned = await this.cloneRepository(repo.id);
      workDir = cloned.workDir;
      cleanup = cloned.cleanup;
      if (!commitSha) commitSha = await cloned.getLatestCommitSha();
    }

    try {
      const records = await this.fetchSubgraphRecords(projectId, repo.id);
      const jsonl = serializeRecords(records);
      const compressed = await compressJsonl(jsonl, tier);
      const paths = artifactPaths(workDir!, repo.id);
      ensureArtifactDir(workDir!);
      ensureGitAttributesMergeOurs(workDir!);
      fs.writeFileSync(paths.artifactPath, compressed);

      const nodeCount = records.filter((r) => r.kind === 'node').length;
      const edgeCount = records.filter((r) => r.kind === 'edge').length;
      const manifest: GraphArtifactManifest = {
        version: 1,
        projectId,
        repoId: repo.id,
        artifactFile: artifactFilename(repo.id),
        sha256: sha256Hex(compressed),
        nodeCount,
        edgeCount,
        exportedAt: new Date().toISOString(),
        commitSha,
        compressionTier: tier,
        zstdLevel: zstdLevelForTier(tier),
      };
      writeManifest(paths.manifestPath, manifest);

      this.logger.log(
        `Exported graph artifact for repo ${repo.id} project ${projectId}: ${nodeCount} nodes, ${edgeCount} edges → ${paths.artifactPath}`,
      );

      return {
        manifest,
        artifactPath: paths.artifactPath,
        manifestPath: paths.manifestPath,
        workDir: workDir!,
      };
    } finally {
      if (opts.cleanupClone !== false && cleanup) cleanup();
    }
  }

  /** Post-sync hook: fast tier for incremental, best for full sync. */
  async exportAfterSync(
    repositoryId: string,
    projectIds: string[],
    workDir: string,
    commitSha: string | null,
    syncKind: 'full' | 'incremental',
  ): Promise<GraphArtifactExportResult | null> {
    const enabled =
      process.env.GRAPH_ARTIFACT_EXPORT_ON_SYNC === '1' ||
      process.env.GRAPH_ARTIFACT_EXPORT_ON_SYNC === 'true';
    if (!enabled) return null;

    const tier: GraphArtifactCompressionTier = syncKind === 'full' ? 'best' : 'fast';
    const projectId = projectIds[0] ?? repositoryId;
    return this.exportGraphArtifact({
      repositoryId,
      projectId,
      workDir,
      commitSha,
      tier,
      cleanupClone: false,
    });
  }

  private async resolveProjectId(repositoryId: string, explicit?: string): Promise<string> {
    if (explicit) return explicit;
    const projectIds = await this.repos.getProjectIdsForRepo(repositoryId);
    if (projectIds.length === 0) return repositoryId;
    return projectIds[0]!;
  }

  private async cloneRepository(repositoryId: string): Promise<{
    workDir: string;
    cleanup: () => void;
    getLatestCommitSha: () => Promise<string | null>;
  }> {
    const repo = await this.repos.findOne(repositoryId);
    if (repo.provider !== 'bitbucket' && repo.provider !== 'github') {
      throw new NotFoundException(`Graph artifact export requires git clone (provider=${repo.provider})`);
    }

    const credentialsRef = await this.credentials.resolveRefForSync({
      repoCredentialsRef: repo.credentialsRef,
      provider: repo.provider,
    });
    const cloneOpts =
      repo.provider === 'bitbucket'
        ? await this.bitbucket.getCloneOpts(repo.projectKey, repo.repoSlug, repo.defaultBranch, credentialsRef)
        : await this.github.getCloneOpts(repo.projectKey, repo.repoSlug, repo.defaultBranch, credentialsRef);

    if (!cloneOpts?.token) {
      throw new NotFoundException('Cannot clone repository for graph artifact export (missing credentials)');
    }

    return runShallowClone({
      cloneUrl: cloneOpts.cloneUrl,
      ref: cloneOpts.ref,
      token: cloneOpts.token,
      tokenUsername: cloneOpts.tokenUsername,
    });
  }

  private async fetchSubgraphRecords(projectId: string, repoId: string) {
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

      const nodeRows: Array<{ labels: unknown; props: unknown }> = [];
      const edgeRows: Array<{
        type: unknown;
        props: unknown;
        fromLabels: unknown;
        fromProps: unknown;
        toLabels: unknown;
        toProps: unknown;
      }> = [];

      for (const gName of graphNames) {
        const graph = client.selectGraph(gName);
        try {
          const nodeRes = (await graph.query(
            `MATCH (n)
             WHERE n.projectId = $projectId AND (n.repoId = $repoId OR n:Project)
             RETURN labels(n) AS labels, properties(n) AS props`,
            { params: { projectId, repoId } },
          )) as { data?: Array<Record<string, unknown>> };

          for (const row of nodeRes.data ?? []) {
            nodeRows.push({ labels: row.labels, props: row.props });
          }

          const edgeRes = (await graph.query(
            `MATCH (a)-[r]->(b)
             WHERE a.projectId = $projectId AND b.projectId = $projectId
               AND ((a.repoId = $repoId OR a:Project) AND (b.repoId = $repoId OR b:Project))
             RETURN type(r) AS type, properties(r) AS props,
                    labels(a) AS fromLabels, properties(a) AS fromProps,
                    labels(b) AS toLabels, properties(b) AS toProps`,
            { params: { projectId, repoId } },
          )) as { data?: Array<Record<string, unknown>> };

          for (const row of edgeRes.data ?? []) {
            edgeRows.push({
              type: row.type,
              props: row.props,
              fromLabels: row.fromLabels,
              fromProps: row.fromProps,
              toLabels: row.toLabels,
              toProps: row.toProps,
            });
          }
        } catch {
          /* graph shard may not exist yet */
        }
      }

      return recordsFromGraphQuery(nodeRows, edgeRows);
    } finally {
      await client.close();
    }
  }
}
