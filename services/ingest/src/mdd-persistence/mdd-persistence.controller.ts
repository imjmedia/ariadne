/**
 * @fileoverview REST: latest persisted MDD per repository.
 */
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { MddPersistenceService } from './mdd-persistence.service';

@Controller('repositories')
export class MddPersistenceController {
  constructor(private readonly mdd: MddPersistenceService) {}

  @Get(':id/mdd/latest')
  async latest(@Param('id') repositoryId: string) {
    const row = await this.mdd.getLatest(repositoryId);
    if (!row) throw new NotFoundException('No MDD snapshot for this repository');
    return {
      id: row.id,
      repositoryId: row.repositoryId,
      projectId: row.projectId,
      commitSha: row.commitSha,
      createdAt: row.createdAt,
      mdd: row.mddJson,
    };
  }
}
