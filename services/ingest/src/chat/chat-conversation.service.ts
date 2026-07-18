/**
 * @fileoverview Persistencia de conversaciones de chat por usuario (repo o proyecto).
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CredentialActor } from '../credentials/credential-actor';
import { ChatConversationEntity } from './entities/chat-conversation.entity';
import { ChatMessageEntity, type ChatMessageRole } from './entities/chat-message.entity';

export interface ChatConversationDto {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessageDto {
  id: string;
  role: ChatMessageRole;
  content: string;
  cypher: string | null;
  createdAt: string;
}

function requireUserId(actor: CredentialActor): string {
  if (!actor.userId) {
    throw new ForbiddenException(
      'Usuario no identificado. Inicia sesión de nuevo; el API debe enviar X-User-Id.',
    );
  }
  return actor.userId;
}

function titleFromMessage(message: string): string {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  if (!oneLine) return 'Nueva conversación';
  return oneLine.length > 72 ? `${oneLine.slice(0, 69)}…` : oneLine;
}

function toConversationDto(row: ChatConversationEntity, messageCount: number): ChatConversationDto {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount,
  };
}

@Injectable()
export class ChatConversationService {
  constructor(
    @InjectRepository(ChatConversationEntity)
    private readonly conversations: Repository<ChatConversationEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messages: Repository<ChatMessageEntity>,
  ) {}

  async listByRepository(actor: CredentialActor, repositoryId: string): Promise<ChatConversationDto[]> {
    const userId = requireUserId(actor);
    const rows = await this.conversations.find({
      where: { userId, repositoryId },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
    return this.withMessageCounts(rows);
  }

  async listByProject(actor: CredentialActor, projectId: string): Promise<ChatConversationDto[]> {
    const userId = requireUserId(actor);
    const rows = await this.conversations.find({
      where: { userId, projectId },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
    return this.withMessageCounts(rows);
  }

  async createForRepository(
    actor: CredentialActor,
    repositoryId: string,
    title?: string | null,
  ): Promise<ChatConversationDto> {
    const userId = requireUserId(actor);
    const row = this.conversations.create({
      userId,
      repositoryId,
      projectId: null,
      title: title?.trim() || null,
    });
    const saved = await this.conversations.save(row);
    return toConversationDto(saved, 0);
  }

  async createForProject(
    actor: CredentialActor,
    projectId: string,
    title?: string | null,
  ): Promise<ChatConversationDto> {
    const userId = requireUserId(actor);
    const row = this.conversations.create({
      userId,
      repositoryId: null,
      projectId,
      title: title?.trim() || null,
    });
    const saved = await this.conversations.save(row);
    return toConversationDto(saved, 0);
  }

  async getMessages(actor: CredentialActor, conversationId: string): Promise<ChatMessageDto[]> {
    await this.getOwnedConversation(actor, conversationId);
    const rows = await this.messages.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      cypher: m.cypher,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async appendMessage(
    actor: CredentialActor,
    conversationId: string,
    dto: { role: ChatMessageRole; content: string; cypher?: string | null },
  ): Promise<ChatMessageDto> {
    const conversation = await this.getOwnedConversation(actor, conversationId);
    const content = dto.content?.trim();
    if (!content) throw new BadRequestException('content is required');

    const row = this.messages.create({
      conversationId,
      role: dto.role,
      content,
      cypher: dto.cypher?.trim() || null,
    });
    const saved = await this.messages.save(row);

    if (dto.role === 'user' && !conversation.title) {
      conversation.title = titleFromMessage(content);
    }
    conversation.updatedAt = new Date();
    await this.conversations.save(conversation);

    return {
      id: saved.id,
      role: saved.role,
      content: saved.content,
      cypher: saved.cypher,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async rename(actor: CredentialActor, conversationId: string, title: string): Promise<ChatConversationDto> {
    const conversation = await this.getOwnedConversation(actor, conversationId);
    const trimmed = title.trim();
    conversation.title = trimmed || null;
    conversation.updatedAt = new Date();
    const saved = await this.conversations.save(conversation);
    const messageCount = await this.messages.count({ where: { conversationId } });
    return toConversationDto(saved, messageCount);
  }

  async remove(actor: CredentialActor, conversationId: string): Promise<void> {
    const conversation = await this.getOwnedConversation(actor, conversationId);
    await this.conversations.remove(conversation);
  }

  private async getOwnedConversation(
    actor: CredentialActor,
    conversationId: string,
  ): Promise<ChatConversationEntity> {
    const userId = requireUserId(actor);
    const conversation = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversación no encontrada');
    if (conversation.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }
    return conversation;
  }

  private async withMessageCounts(rows: ChatConversationEntity[]): Promise<ChatConversationDto[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const countsRaw = await this.messages
      .createQueryBuilder('m')
      .select('m.conversation_id', 'conversationId')
      .addSelect('COUNT(*)', 'count')
      .where('m.conversation_id IN (:...ids)', { ids })
      .groupBy('m.conversation_id')
      .getRawMany<{ conversationId: string; count: string }>();
    const countMap = new Map(countsRaw.map((c) => [c.conversationId, Number(c.count)]));
    return rows.map((r) => toConversationDto(r, countMap.get(r.id) ?? 0));
  }
}
