import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEntity } from './entities/domain.entity';
import { ProjectDomainDependencyEntity } from './entities/project-domain-dependency.entity';
import { DomainDomainVisibilityEntity } from './entities/domain-domain-visibility.entity';
import { ProjectEntity } from '../projects/entities/project.entity';
import { IndexedFile } from '../repositories/entities/indexed-file.entity';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { DomainDependencyInferenceService } from './domain-dependency-inference.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DomainEntity,
      ProjectDomainDependencyEntity,
      DomainDomainVisibilityEntity,
      ProjectEntity,
      IndexedFile,
    ]),
    RepositoriesModule,
  ],
  controllers: [DomainsController],
  providers: [DomainsService, DomainDependencyInferenceService],
  exports: [DomainsService, DomainDependencyInferenceService, TypeOrmModule],
})
export class DomainsModule {}
