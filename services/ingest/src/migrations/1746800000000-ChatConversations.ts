import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatConversations1746800000000 implements MigrationInterface {
  name = 'ChatConversations1746800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "repository_id" uuid NULL,
        "project_id" uuid NULL,
        "title" varchar(256) NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_chat_conversations_scope" CHECK (
          ("repository_id" IS NOT NULL AND "project_id" IS NULL) OR
          ("repository_id" IS NULL AND "project_id" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_conversations_user_repo"
      ON "chat_conversations" ("user_id", "repository_id", "updated_at" DESC)
      WHERE "repository_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_conversations_user_project"
      ON "chat_conversations" ("user_id", "project_id", "updated_at" DESC)
      WHERE "project_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "role" varchar(16) NOT NULL,
        "content" text NOT NULL,
        "cypher" text NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_conversation"
          FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_messages_conversation_created"
      ON "chat_messages" ("conversation_id", "created_at" ASC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_messages_conversation_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_conversations_user_project"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_conversations_user_repo"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_conversations"`);
  }
}
