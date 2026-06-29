import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DetectChangesController } from './detect-changes.controller';
import { DetectChangesGraphService } from './detect-changes-graph.service';
import { DetectChangesService } from './detect-changes.service';

@Module({
  imports: [RepositoriesModule, ProjectsModule],
  controllers: [DetectChangesController],
  providers: [DetectChangesService, DetectChangesGraphService],
})
export class AnalysisModule {}
