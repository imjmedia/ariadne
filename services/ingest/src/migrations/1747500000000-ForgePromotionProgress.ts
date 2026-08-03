import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ForgePromotionProgress1747500000000 implements MigrationInterface {
  name = 'ForgePromotionProgress1747500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      ADD COLUMN IF NOT EXISTS "forge_promotion_phase" varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      ADD COLUMN IF NOT EXISTS "forge_promotion_percent" smallint NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_promotion_phase" varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      ADD COLUMN IF NOT EXISTS "forge_promotion_percent" smallint NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      DROP COLUMN IF EXISTS "forge_promotion_percent"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_conversations"
      DROP COLUMN IF EXISTS "forge_promotion_phase"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      DROP COLUMN IF EXISTS "forge_promotion_percent"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_integration_batches"
      DROP COLUMN IF EXISTS "forge_promotion_phase"
    `);
  }
}
