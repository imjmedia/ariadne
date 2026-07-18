/**
 * @fileoverview Conversación de chat persistida por usuario y repo/proyecto.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChatMessageEntity } from './chat-message.entity';

@Entity('chat_conversations')
export class ChatConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'repository_id', type: 'uuid', nullable: true })
  repositoryId!: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  title!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => ChatMessageEntity, (m) => m.conversation)
  messages?: ChatMessageEntity[];
}
