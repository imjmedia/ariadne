/**
 * Internal API for MCP brownfield tools.
 */
import { Body, Controller, Param, Post } from '@nestjs/common';
import { RepositoriesService } from '../repositories/repositories.service';
import { BrownfieldParityPackService } from './brownfield-parity-pack.service';
import { ScaffoldFromMddService, type ScaffoldTarget } from '../scaffold/scaffold-from-mdd.service';

@Controller('internal/repositories')
export class BrownfieldInternalController {
  constructor(
    private readonly repos: RepositoriesService,
    private readonly parityPack: BrownfieldParityPackService,
    private readonly scaffold: ScaffoldFromMddService,
  ) {}

  private async resolveProjectId(repoId: string): Promise<string> {
    const ids = await this.repos.getProjectIdsForRepo(repoId);
    return ids[0] ?? repoId;
  }

  @Post(':repoId/brownfield-parity-pack')
  async exportParityPack(
    @Param('repoId') repoId: string,
    @Body() body: { projectId?: string; userDescription?: string },
  ) {
    const projectId = body.projectId?.trim() || (await this.resolveProjectId(repoId));
    return this.parityPack.build(repoId, projectId, body.userDescription);
  }

  @Post(':repoId/scaffold-from-mdd')
  async scaffoldFromMdd(
    @Param('repoId') repoId: string,
    @Body() body: { projectId?: string; targets?: ScaffoldTarget[] },
  ) {
    const projectId = body.projectId?.trim() || (await this.resolveProjectId(repoId));
    return this.scaffold.generate(repoId, projectId, body.targets ?? ['nest', 'react', 'prisma']);
  }
}
