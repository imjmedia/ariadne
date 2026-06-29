/**
 * Detect changes blast-radius analysis for a repository diff.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import {
  buildDetectChangesResult,
  parseDiffMode,
  parseDiffSymbols,
  type DetectChangesResult,
  type DiffMode,
} from 'ariadne-common';
import { RepositoriesService } from '../repositories/repositories.service';
import { DetectChangesGraphService } from './detect-changes-graph.service';

export type DetectChangesRequest = {
  mode?: string;
  diff?: string;
  baseRef?: string;
};

@Injectable()
export class DetectChangesService {
  constructor(
    private readonly repos: RepositoriesService,
    private readonly graph: DetectChangesGraphService,
  ) {}

  async detectForRepository(
    repositoryId: string,
    body: DetectChangesRequest,
  ): Promise<DetectChangesResult & { projectId: string; repositoryId: string }> {
    const diff = body.diff?.trim();
    if (!diff) {
      throw new BadRequestException(
        'Body field "diff" is required (unified git diff). Run git locally and POST the raw output.',
      );
    }

    const mode: DiffMode = parseDiffMode(body.mode);
    const repo = await this.repos.findOne(repositoryId);
    const projectIds = await this.repos.getProjectIdsForRepo(repositoryId);
    const projectId = projectIds[0] ?? repo.id;

    const { removed, added, edited } = parseDiffSymbols(diff);
    const allNames = [...removed, ...added, ...edited];
    const dependentCounts = await this.graph.batchDependentCounts(projectId, allNames, repo.id);

    const result = buildDetectChangesResult(mode, diff, dependentCounts);
    return { ...result, projectId, repositoryId: repo.id };
  }
}
