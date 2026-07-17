/**
 * @fileoverview MDD persistence module (post-sync snapshots).
 */
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MddSnapshotEntity } from './entities/mdd-snapshot.entity';
import { MddPersistenceService } from './mdd-persistence.service';
import { MddPersistenceController } from './mdd-persistence.controller';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MddSnapshotEntity, RepositoryEntity]),
    forwardRef(() => ChatModule),
  ],
  controllers: [MddPersistenceController],
  providers: [MddPersistenceService],
  exports: [MddPersistenceService],
})
export class MddPersistenceModule {}
