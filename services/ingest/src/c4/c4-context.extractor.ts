/**
 * @fileoverview Extrae C4ContextSpec desde Postgres (dominios, whitelist, visibilidad).
 * Respeta el mismo alcance que getCypherShardContexts (deps + domain_domain_visibility).
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { C4ContextSpec } from 'ariadne-common';
import { DomainEntity } from '../domains/entities/domain.entity';
import { ProjectDomainDependencyEntity } from '../domains/entities/project-domain-dependency.entity';
import { DomainDomainVisibilityEntity } from '../domains/entities/domain-domain-visibility.entity';
import { ProjectEntity } from '../projects/entities/project.entity';
import { RepositoriesService } from '../repositories/repositories.service';

@Injectable()
export class C4ContextExtractor {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(DomainEntity)
    private readonly domainRepo: Repository<DomainEntity>,
    @InjectRepository(ProjectDomainDependencyEntity)
    private readonly depRepo: Repository<ProjectDomainDependencyEntity>,
    @InjectRepository(DomainDomainVisibilityEntity)
    private readonly visRepo: Repository<DomainDomainVisibilityEntity>,
    private readonly repos: RepositoriesService,
  ) {}

  async buildSpec(projectId: string): Promise<C4ContextSpec> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    let domain: C4ContextSpec['domain'] = null;
    if (project.domainId) {
      const d = await this.domainRepo.findOne({ where: { id: project.domainId } });
      if (d) {
        domain = {
          id: d.id,
          name: d.name,
          description: d.description ?? null,
        };
      }
    }

    const linked = await this.repos.findAll(projectId);
    const repos = linked.map((r) => ({
      id: r.id,
      label: `${r.projectKey}/${r.repoSlug}`,
    }));

    const depRows = await this.depRepo.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
    const depDomainIds = depRows.map((r) => r.dependsOnDomainId);
    const depDomains =
      depDomainIds.length > 0
        ? await this.domainRepo.find({ where: { id: In(depDomainIds) }, select: ['id', 'name'] })
        : [];
    const depNameById = new Map(depDomains.map((d) => [d.id, d.name] as const));

    const visibilityRows = project.domainId
      ? await this.visRepo.find({
          where: { fromDomainId: project.domainId },
          order: { createdAt: 'ASC' },
        })
      : [];

    const visDomainIds = visibilityRows.map((r) => r.toDomainId);
    const visDomains =
      visDomainIds.length > 0
        ? await this.domainRepo.find({ where: { id: In(visDomainIds) }, select: ['id', 'name'] })
        : [];
    const visNameById = new Map(visDomains.map((d) => [d.id, d.name] as const));

    return {
      projectId,
      projectName: project.name?.trim() || projectId,
      domain,
      repos,
      dependencies: depRows.map((r) => ({
        dependencyId: r.id,
        domainId: r.dependsOnDomainId,
        domainName: depNameById.get(r.dependsOnDomainId) ?? r.dependsOnDomainId,
        connectionType: r.connectionType,
        description: r.description ?? null,
      })),
      visibilityEdges: visibilityRows.map((r) => ({
        edgeId: r.id,
        toDomainId: r.toDomainId,
        toDomainName: visNameById.get(r.toDomainId) ?? r.toDomainId,
        description: r.description ?? null,
      })),
    };
  }
}
