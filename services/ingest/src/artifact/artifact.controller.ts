/**
 * POST /repositories/:id/export-graph-artifact — export Falkor subgraph to clone `.ariadne/`.
 */
import { Body, Controller, Param, Post } from '@nestjs/common';
import { GraphExportService } from './graph-export.service';
import type { GraphArtifactCompressionTier } from './graph-artifact.types';

export class ExportGraphArtifactDto {
  projectId?: string;
  tier?: GraphArtifactCompressionTier;
}

@Controller('repositories')
export class ArtifactController {
  constructor(private readonly exportService: GraphExportService) {}

  @Post(':id/export-graph-artifact')
  exportGraphArtifact(@Param('id') id: string, @Body() body: ExportGraphArtifactDto) {
    return this.exportService.exportGraphArtifact({
      repositoryId: id,
      projectId: body.projectId,
      tier: body.tier ?? 'best',
    });
  }
}
