/**
 * @fileoverview Importación de handoffs NEW-LEG y promoción batch a The Forge.
 */
import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { actorFromHeaders } from '../credentials/credential-actor';
import {
  ChatIntegrationHandoffService,
  type PromoteIntegrationBatchBody,
} from '../theforge/chat-integration-handoff.service';

@Controller('projects/:projectId/integration-handoffs')
export class ProjectIntegrationHandoffsController {
  constructor(private readonly service: ChatIntegrationHandoffService) {}

  @Get('sources')
  listSources(
    @Param('projectId') projectId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.listSources(actorFromHeaders(headers), projectId);
  }

  @Post('import')
  importHandoffs(
    @Param('projectId') projectId: string,
    @Body() body: { sourceForgeProjectId: string },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.importHandoffs(
      actorFromHeaders(headers),
      projectId,
      body.sourceForgeProjectId,
    );
  }
}

@Controller('integration-batches')
export class IntegrationBatchesController {
  constructor(private readonly service: ChatIntegrationHandoffService) {}

  @Get(':batchId')
  getBatch(
    @Param('batchId') batchId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.getBatch(actorFromHeaders(headers), batchId);
  }

  @Delete(':batchId')
  deleteBatch(
    @Param('batchId') batchId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.deleteBatch(actorFromHeaders(headers), batchId);
  }

  @Post(':batchId/preview-theforge-pack')
  previewPromotion(
    @Param('batchId') batchId: string,
    @Body() body: Partial<PromoteIntegrationBatchBody>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.previewBatchPromotion(actorFromHeaders(headers), batchId, body ?? {});
  }

  @Get(':batchId/preview-theforge-pack/result')
  getPreviewResult(
    @Param('batchId') batchId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.getBatchPreviewResult(actorFromHeaders(headers), batchId);
  }

  @Post(':batchId/promote-to-theforge')
  promote(
    @Param('batchId') batchId: string,
    @Body() body: PromoteIntegrationBatchBody,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.promoteBatch(actorFromHeaders(headers), batchId, body);
  }
}
