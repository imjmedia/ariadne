import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatIntegrationBatchPreviewCache1747400000000 implements MigrationInterface {
  name = 'ChatIntegrationBatchPreviewCache1747400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      ADD COLUMN IF NOT EXISTS "forge_preview_params_hash" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      ADD COLUMN IF NOT EXISTS "forge_preview_pack" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      DROP COLUMN IF EXISTS "forge_preview_pack"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      DROP COLUMN IF EXISTS "forge_preview_params_hash"
    `);
  }
}
