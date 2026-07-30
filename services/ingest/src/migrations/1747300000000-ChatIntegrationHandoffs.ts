import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatIntegrationHandoffs1747300000000 implements MigrationInterface {
  name = 'ChatIntegrationHandoffs1747300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_integration_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "source_forge_project_id" varchar(64) NOT NULL,
        "source_forge_project_name" varchar(256) NULL,
        "label" varchar(256) NOT NULL,
        "forge_project_id" varchar(64) NULL,
        "forge_stage_id" varchar(64) NULL,
        "forge_stage_url" varchar(512) NULL,
        "forge_promoted_at" TIMESTAMPTZ NULL,
        "forge_promotion_status" varchar(16) NULL,
        "forge_promotion_idempotency_key" varchar(64) NULL,
        "forge_promotion_last_error" text NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_integration_batches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_integration_batches_user_project"
      ON "chat_integration_batches" ("user_id", "project_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "integration_batch_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "integration_handoff_id" varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "FK_chat_conversations_integration_batch"
      FOREIGN KEY ("integration_batch_id") REFERENCES "chat_integration_batches"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_chat_integration_batches_source"
      ON "chat_integration_batches" ("user_id", "project_id", "source_forge_project_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_chat_conversations_batch_handoff"
      ON "chat_conversations" ("integration_batch_id", "integration_handoff_id")
      WHERE "integration_batch_id" IS NOT NULL AND "integration_handoff_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_chat_conversations_batch_handoff"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_chat_integration_batches_source"`);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "FK_chat_conversations_integration_batch"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "integration_handoff_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "integration_batch_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_integration_batches_user_project"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_integration_batches"`);
  }
}
