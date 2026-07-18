/**
 * @fileoverview REST de conversaciones persistidas (por usuario, repo o proyecto).
 */
import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { actorFromHeaders } from '../credentials/credential-actor';
import type { PromoteToTheForgeBody } from '../theforge/theforge-promotion.service';
import { TheForgePromotionService } from '../theforge/theforge-promotion.service';
import { ChatConversationService } from './chat-conversation.service';

@Controller('repositories/:repositoryId/conversations')
export class RepositoryChatConversationsController {
  constructor(private readonly service: ChatConversationService) {}

  @Get()
  list(
    @Param('repositoryId') repositoryId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.listByRepository(actorFromHeaders(headers), repositoryId);
  }

  @Post()
  create(
    @Param('repositoryId') repositoryId: string,
    @Body() body: { title?: string | null },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.createForRepository(actorFromHeaders(headers), repositoryId, body?.title);
  }
}

@Controller('projects/:projectId/conversations')
export class ProjectChatConversationsController {
  constructor(private readonly service: ChatConversationService) {}

  @Get()
  list(
    @Param('projectId') projectId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.listByProject(actorFromHeaders(headers), projectId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() body: { title?: string | null },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.createForProject(actorFromHeaders(headers), projectId, body?.title);
  }
}

@Controller('conversations')
export class ChatConversationsController {
  constructor(
    private readonly service: ChatConversationService,
    private readonly forgePromotion: TheForgePromotionService,
  ) {}

  @Get(':conversationId/messages')
  getMessages(
    @Param('conversationId') conversationId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.getMessages(actorFromHeaders(headers), conversationId);
  }

  @Post(':conversationId/messages')
  appendMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: { role: 'user' | 'assistant'; content: string; cypher?: string | null },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.appendMessage(actorFromHeaders(headers), conversationId, body);
  }

  @Patch(':conversationId')
  rename(
    @Param('conversationId') conversationId: string,
    @Body() body: { title: string },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.rename(actorFromHeaders(headers), conversationId, body.title ?? '');
  }

  @Delete(':conversationId')
  remove(
    @Param('conversationId') conversationId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.service.remove(actorFromHeaders(headers), conversationId);
  }

  @Get(':conversationId/forge-promotion')
  getForgePromotion(
    @Param('conversationId') conversationId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.forgePromotion.getPromotionState(actorFromHeaders(headers), conversationId);
  }

  @Post(':conversationId/preview-theforge-pack')
  previewTheForgePack(
    @Param('conversationId') conversationId: string,
    @Body() body: Partial<PromoteToTheForgeBody>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.forgePromotion.previewPack(actorFromHeaders(headers), conversationId, body ?? {});
  }

  @Post(':conversationId/promote-to-theforge')
  promoteToTheForge(
    @Param('conversationId') conversationId: string,
    @Body() body: PromoteToTheForgeBody,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.forgePromotion.promote(actorFromHeaders(headers), conversationId, body);
  }
}
