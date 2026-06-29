/**
 * Graph artifact export/import for team bootstrap (Camino D phase 3).
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from '../projects/entities/project.entity';
import { RepositoriesModule } from '../repositories/repositories.module';
import { BitbucketModule } from '../bitbucket/bitbucket.module';
import { ProvidersModule } from '../providers/providers.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { ArtifactController } from './artifact.controller';
import { GraphExportService } from './graph-export.service';
import { GraphImportService } from './graph-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectEntity]),
    RepositoriesModule,
    BitbucketModule,
    ProvidersModule,
    CredentialsModule,
  ],
  controllers: [ArtifactController],
  providers: [GraphExportService, GraphImportService],
  exports: [GraphExportService, GraphImportService],
})
export class ArtifactModule {}
