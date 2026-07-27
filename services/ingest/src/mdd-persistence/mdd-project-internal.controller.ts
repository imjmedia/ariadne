/**
 * API interna: MDD fusionado por proyecto (multi-root).
 */
import { Body, Controller, Param, Post } from '@nestjs/common';
import { MddProjectMergeService } from './mdd-project-merge.service';

@Controller('internal/projects')
export class MddProjectInternalController {
  constructor(private readonly merge: MddProjectMergeService) {}

  /**
   * POST /internal/projects/:projectId/mdd-evidence-merged
   * Body: { userDescription?, preferSnapshots?, live? }
   */
  @Post(':projectId/mdd-evidence-merged')
  async mergedMddEvidence(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      userDescription?: string;
      preferSnapshots?: boolean;
      live?: boolean;
    },
  ) {
    const result = await this.merge.buildMergedForProject(
      projectId,
      body.userDescription?.trim() || 'Brownfield merged MDD (project multi-root)',
      {
        preferSnapshots: body.preferSnapshots,
        live: body.live,
      },
    );
    return {
      projectId: result.projectId,
      projectName: result.projectName,
      mergeMode: result.sources.length > 1 ? 'project_multi_root' : 'single_repo',
      repositoryIds: result.sources.map((s) => s.repositoryId),
      mddSources: result.sources.map((s) => ({
        repositoryId: s.repositoryId,
        slug: s.slug,
        fromSnapshot: s.fromSnapshot,
        snapshotId: s.snapshotId ?? null,
      })),
      mdd: result.mdd,
    };
  }
}
