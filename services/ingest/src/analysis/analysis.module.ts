import { Module, forwardRef } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { C4Module } from '../c4/c4.module';
import { DetectChangesController } from './detect-changes.controller';
import { DetectChangesGraphService } from './detect-changes-graph.service';
import { DetectChangesService } from './detect-changes.service';

@Module({
  imports: [RepositoriesModule, ProjectsModule, forwardRef(() => C4Module)],
  controllers: [DetectChangesController],
  providers: [DetectChangesService, DetectChangesGraphService],
})
export class AnalysisModule {}
