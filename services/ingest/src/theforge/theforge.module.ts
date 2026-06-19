/**
 * @fileoverview The Forge integration hooks (brownfield converge after reindex).
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { TheForgeConvergeService } from './theforge-converge.service';

@Module({
  imports: [TypeOrmModule.forFeature([RepositoryEntity])],
  providers: [TheForgeConvergeService],
  exports: [TheForgeConvergeService],
})
export class TheForgeModule {}
