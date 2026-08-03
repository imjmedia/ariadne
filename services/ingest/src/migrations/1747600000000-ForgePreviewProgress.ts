import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ForgePreviewProgress1747600000000 implements MigrationInterface {
  name = 'ForgePreviewProgress1747600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      ADD COLUMN IF NOT EXISTS "forge_preview_status" varchar(16) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      ADD COLUMN IF NOT EXISTS "forge_preview_phase" varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      ADD COLUMN IF NOT EXISTS "forge_preview_percent" smallint NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      ADD COLUMN IF NOT EXISTS "forge_preview_last_error" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      ADD COLUMN IF NOT EXISTS "forge_preview_result" jsonb NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_preview_status" varchar(16) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_preview_phase" varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_preview_percent" smallint NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_preview_last_error" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_preview_result" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      DROP COLUMN IF EXISTS "forge_preview_result"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      DROP COLUMN IF EXISTS "forge_preview_last_error"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      DROP COLUMN IF EXISTS "forge_preview_percent"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      DROP COLUMN IF EXISTS "forge_preview_phase"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      DROP COLUMN IF EXISTS "forge_preview_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      DROP COLUMN IF EXISTS "forge_preview_result"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      DROP COLUMN IF EXISTS "forge_preview_last_error"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      DROP COLUMN IF EXISTS "forge_preview_percent"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      DROP COLUMN IF EXISTS "forge_preview_phase"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      DROP COLUMN IF EXISTS "forge_preview_status"
    `);
  }
}
