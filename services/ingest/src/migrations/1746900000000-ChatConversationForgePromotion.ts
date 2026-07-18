import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatConversationForgePromotion1746900000000 implements MigrationInterface {
  name = 'ChatConversationForgePromotion1746900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_project_id" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_stage_id" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_stage_url" varchar(512) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_promoted_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_promotion_status" varchar(16) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_promotion_idempotency_key" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_promotion_last_error" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "forge_promotion_last_error"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "forge_promotion_idempotency_key"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "forge_promotion_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "forge_promoted_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "forge_stage_url"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "forge_stage_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "forge_project_id"
    `);
  }
}
