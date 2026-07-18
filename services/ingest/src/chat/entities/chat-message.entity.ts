/**
 * @fileoverview Mensaje dentro de una conversación de chat persistida.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatConversationEntity } from './chat-conversation.entity';

export type ChatMessageRole = 'user' | 'assistant';

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => ChatConversationEntity, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: ChatConversationEntity;

  @Column({ type: 'varchar', length: 16 })
  role!: ChatMessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', nullable: true })
  cypher!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
