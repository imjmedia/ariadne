/**
 * Internal API: brownfield parity pack fusionado por proyecto.
 */
import { Body, Controller, Param, Post } from '@nestjs/common';
import { BrownfieldParityPackService } from './brownfield-parity-pack.service';

@Controller('internal/projects')
export class BrownfieldProjectInternalController {
  constructor(private readonly parityPack: BrownfieldParityPackService) {}

  @Post(':projectId/brownfield-parity-pack')
  async exportProjectParityPack(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      userDescription?: string;
      preferSnapshots?: boolean;
      live?: boolean;
    },
  ) {
    return this.parityPack.buildForProject(projectId, body.userDescription, {
      preferSnapshots: body.preferSnapshots,
      live: body.live,
    });
  }
}
