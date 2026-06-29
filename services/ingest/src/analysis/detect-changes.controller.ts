/**
 * POST /repositories/:id/detect-changes — blast radius for a unified git diff.
 */
import { Body, Controller, Param, Post } from '@nestjs/common';
import { DetectChangesService, type DetectChangesRequest } from './detect-changes.service';

@Controller('repositories')
export class DetectChangesController {
  constructor(private readonly service: DetectChangesService) {}

  @Post(':id/detect-changes')
  detectChanges(@Param('id') id: string, @Body() body: DetectChangesRequest) {
    return this.service.detectForRepository(id, body);
  }
}
