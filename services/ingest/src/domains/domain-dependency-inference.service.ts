/**
 * @fileoverview Infiere whitelist proyecto→dominio desde índice (package.json, workspaces, compose).
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepositoriesService } from '../repositories/repositories.service';
import { FileContentService } from '../repositories/file-content.service';
import { IndexedFile } from '../repositories/entities/indexed-file.entity';
import { scanC4Infrastructure } from '../c4/c4-infrastructure';
import { DomainsService, type ProjectDomainDependencyDto } from './domains.service';
import {
  inferProjectDomainDependencies,
  type InferredDomainDependency,
} from './domain-dependency-inference.util';

export interface InferProjectDomainDependenciesResult {
  added: ProjectDomainDependencyDto[];
  inferred: InferredDomainDependency[];
}

@Injectable()
export class DomainDependencyInferenceService {
  private readonly logger = new Logger(DomainDependencyInferenceService.name);

  constructor(
    private readonly domains: DomainsService,
    private readonly repos: RepositoriesService,
    private readonly fileContent: FileContentService,
    @InjectRepository(IndexedFile)
    private readonly indexedFiles: Repository<IndexedFile>,
  ) {}

  async inferAndApply(projectId: string): Promise<InferProjectDomainDependenciesResult> {
    const project = await this.domains.getProjectDomainContext(projectId);
    const catalog = await this.domains.findAll();
    const existing = await this.domains.listProjectDependencies(projectId);

    const packageDependencyNames: string[] = [];
    const workspaceEngineNames: string[] = [];
    const composeServiceNames: string[] = [];

    const linked = await this.repos.findAll(projectId);
    for (const repo of linked) {
      const paths = await this.collectRepoPaths(repo.id);
      const getContent = async (relPath: string) => {
        try {
          return await this.fileContent.getFileContent(repo.id, relPath);
        } catch {
          return null;
        }
      };

      for (const p of paths) {
        if (!p.endsWith('package.json')) continue;
        const raw = await getContent(p);
        if (!raw) continue;
        try {
          const pkg = JSON.parse(raw) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };
          packageDependencyNames.push(
            ...Object.keys(pkg.dependencies ?? {}),
            ...Object.keys(pkg.devDependencies ?? {}),
          );
        } catch {
          /* ignore malformed package.json */
        }
      }

      const pathSet = new Set(paths);
      const { spec } = await scanC4Infrastructure(
        pathSet,
        getContent,
        `${repo.projectKey}/${repo.repoSlug}`,
      );
      for (const c of spec.containers) {
        if (c.c4Kind === 'database') {
          composeServiceNames.push(c.name);
          continue;
        }
        workspaceEngineNames.push(c.name);
      }
    }

    const inferred = inferProjectDomainDependencies({
      projectDomainId: project.domainId,
      catalog: catalog.map((d) => ({ id: d.id, name: d.name })),
      existingDependsOnDomainIds: existing.map((d) => d.dependsOnDomainId),
      packageDependencyNames,
      workspaceEngineNames,
      composeServiceNames,
    });

    const added: ProjectDomainDependencyDto[] = [];
    for (const row of inferred) {
      try {
        const saved = await this.domains.addProjectDependency(projectId, {
          dependsOnDomainId: row.dependsOnDomainId,
          connectionType: row.connectionType,
          description: row.description,
        });
        added.push(saved);
      } catch (e) {
        this.logger.debug(
          `Skip inferred dependency ${row.dependsOnDomainName}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return { added, inferred };
  }

  private async collectRepoPaths(repositoryId: string): Promise<string[]> {
    const rows = await this.indexedFiles.find({
      where: { repositoryId },
      select: ['path'],
    });
    if (rows.length > 0) return rows.map((r) => r.path);
    return this.fileContent.listFiles(repositoryId);
  }
}
