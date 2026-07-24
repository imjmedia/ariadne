/**
 * Vincula / desvincula un proyecto Ariadne con un proyecto brownfield en The Forge.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProjectEntity } from '../projects/entities/project.entity';
import { ProjectRepositoryEntity } from '../repositories/entities/project-repository.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';

export interface ProjectTheForgeLinkDto {
  theforgeProjectId: string | null;
  theforgeProjectName: string | null;
}

@Injectable()
export class TheForgeProjectLinkService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(ProjectRepositoryEntity)
    private readonly projectRepoRepo: Repository<ProjectRepositoryEntity>,
    @InjectRepository(RepositoryEntity)
    private readonly repoRepo: Repository<RepositoryEntity>,
  ) {}

  async linkProject(
    ariadneProjectId: string,
    forgeProjectId: string,
    forgeProjectName?: string | null,
  ): Promise<ProjectTheForgeLinkDto> {
    const trimmedId = forgeProjectId?.trim();
    if (!trimmedId) {
      throw new BadRequestException('forgeProjectId es obligatorio');
    }
    const project = await this.projectRepo.findOne({ where: { id: ariadneProjectId } });
    if (!project) throw new NotFoundException(`Project ${ariadneProjectId} not found`);

    const name = forgeProjectName?.trim() || null;
    await this.projectRepo.update(ariadneProjectId, {
      theforgeProjectId: trimmedId,
      theforgeProjectName: name,
    });

    const prs = await this.projectRepoRepo.find({
      where: { projectId: ariadneProjectId },
      select: ['repoId'],
    });
    const repoIds = prs.map((pr) => pr.repoId);
    if (repoIds.length > 0) {
      await this.repoRepo.update({ id: In(repoIds) }, { theforgeProjectId: trimmedId });
    }

    return { theforgeProjectId: trimmedId, theforgeProjectName: name };
  }

  async unlinkProject(ariadneProjectId: string): Promise<ProjectTheForgeLinkDto> {
    const project = await this.projectRepo.findOne({ where: { id: ariadneProjectId } });
    if (!project) throw new NotFoundException(`Project ${ariadneProjectId} not found`);

    const previousForgeId = project.theforgeProjectId?.trim() || null;
    await this.projectRepo.update(ariadneProjectId, {
      theforgeProjectId: null,
      theforgeProjectName: null,
    });

    if (previousForgeId) {
      const prs = await this.projectRepoRepo.find({
        where: { projectId: ariadneProjectId },
        select: ['repoId'],
      });
      const repoIds = prs.map((pr) => pr.repoId);
      if (repoIds.length > 0) {
        await this.repoRepo
          .createQueryBuilder()
          .update(RepositoryEntity)
          .set({ theforgeProjectId: null })
          .where('id IN (:...repoIds)', { repoIds })
          .andWhere('theforge_project_id = :forgeId', { forgeId: previousForgeId })
          .execute();
      }
    }

    return { theforgeProjectId: null, theforgeProjectName: null };
  }
}
