/**
 * @fileoverview C4 Component: container pathPrefix → subgrafo Falkor → C4Model.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  falkorSubgraphToC4ComponentModel,
  infrastructureSpecToC4Model,
  type C4Model,
} from 'ariadne-common';
import { RepositoriesService } from '../repositories/repositories.service';
import { FileContentService } from '../repositories/file-content.service';
import { IndexedFile } from '../repositories/entities/indexed-file.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { scanC4Infrastructure } from './c4-infrastructure';
import { C4FalkorGraph } from './c4-falkor.graph';

@Injectable()
export class C4ComponentExtractor {
  constructor(
    private readonly repos: RepositoriesService,
    private readonly fileContent: FileContentService,
    private readonly falkor: C4FalkorGraph,
    @InjectRepository(IndexedFile)
    private readonly indexedFiles: Repository<IndexedFile>,
  ) {}

  async buildComponentModel(
    projectId: string,
    opts?: { containerKey?: string; repoId?: string },
  ): Promise<C4Model> {
    const linked = await this.repos.findAll(projectId);
    if (linked.length === 0) {
      throw new NotFoundException('Proyecto sin repositorios');
    }

    const targetRepoId = opts?.repoId ?? linked[0]!.id;
    const repo = linked.find((r) => r.id === targetRepoId) ?? linked[0]!;

    const rows = await this.indexedFiles.find({
      where: { repositoryId: repo.id },
      select: ['path'],
    });
    const pathSet = new Set(rows.map((r) => r.path));
    if (pathSet.size === 0) {
      const listed = await this.fileContent.listFiles(repo.id);
      for (const p of listed) pathSet.add(p);
    }

    const getContent = async (relPath: string) => {
      try {
        return await this.fileContent.getFileContent(repo.id, relPath);
      } catch {
        return null;
      }
    };

    const systemName = `${repo.projectKey}/${repo.repoSlug}`;
    const { spec } = await scanC4Infrastructure(pathSet, getContent, systemName);
    const containerModel = infrastructureSpecToC4Model(spec, projectId, { repoId: repo.id });

    const containers = containerModel.elements.filter(
      (e) => e.kind === 'container' && e.containerKey && e.containerKey !== '_unassigned',
    );

    let target = containers[0];
    if (opts?.containerKey) {
      target = containers.find((c) => c.containerKey === opts.containerKey) ?? target;
    }
    if (!target?.containerKey) {
      throw new NotFoundException('No se encontró container con pathPrefix para C4 Component');
    }

    const infraContainer = spec.containers.find((c) => c.key === target.containerKey);
    const pathPrefixes = infraContainer?.pathPrefixes?.length
      ? infraContainer.pathPrefixes
      : [`services/${target.containerKey}/`, `${target.containerKey}/`, 'frontend/', 'src/'];

    const { nodes, edges } = await this.falkor.fetchComponentSubgraph(projectId, {
      pathPrefixes,
      containerKey: target.containerKey,
      repoId: repo.id,
    });

    if (nodes.length === 0) {
      throw new NotFoundException(
        `Sin componentes Falkor bajo ${pathPrefixes.join(', ')}. Ejecuta sync completo primero.`,
      );
    }

    return falkorSubgraphToC4ComponentModel({
      projectId,
      containerKey: target.containerKey,
      containerName: target.name,
      pathPrefixes,
      repoId: repo.id,
      nodes,
      edges,
    });
  }
}
