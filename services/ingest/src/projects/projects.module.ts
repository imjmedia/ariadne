/**
 * @fileoverview Módulo de proyectos (multi-root): CRUD, listado con repos, file por proyecto.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from './entities/project.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ProjectRepositoryEntity } from '../repositories/entities/project-repository.entity';
import { ProjectDomainDependencyEntity } from '../domains/entities/project-domain-dependency.entity';
import { DomainDomainVisibilityEntity } from '../domains/entities/domain-domain-visibility.entity';
import { DomainEntity } from '../domains/entities/domain.entity';
import { SyncJob } from '../repositories/entities/sync-job.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SyncStatusService } from './sync-status.service';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DomainsModule } from '../domains/domains.module';
import { TheForgeModule } from '../theforge/theforge.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEntity,
      ProjectRepositoryEntity,
      RepositoryEntity,
      ProjectDomainDependencyEntity,
      DomainDomainVisibilityEntity,
      DomainEntity,
      SyncJob,
    ]),
    RepositoriesModule,
    DomainsModule,
    TheForgeModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, SyncStatusService],
  exports: [ProjectsService, SyncStatusService],
})
export class ProjectsModule {}
