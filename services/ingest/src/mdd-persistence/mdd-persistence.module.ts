/**
 * @fileoverview MDD persistence module (post-sync snapshots).
 */
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MddSnapshotEntity } from './entities/mdd-snapshot.entity';
import { MddPersistenceService } from './mdd-persistence.service';
import { MddProjectMergeService } from './mdd-project-merge.service';
import { MddPersistenceController } from './mdd-persistence.controller';
import { MddProjectInternalController } from './mdd-project-internal.controller';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ChatModule } from '../chat/chat.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MddSnapshotEntity, RepositoryEntity]),
    forwardRef(() => ChatModule),
    forwardRef(() => ProjectsModule),
  ],
  controllers: [MddPersistenceController, MddProjectInternalController],
  providers: [MddPersistenceService, MddProjectMergeService],
  exports: [MddPersistenceService, MddProjectMergeService],
})
export class MddPersistenceModule {}
