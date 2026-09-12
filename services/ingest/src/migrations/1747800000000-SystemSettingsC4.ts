import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SystemSettingsC41747800000000 implements MigrationInterface {
  name = 'SystemSettingsC41747800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "c4_enabled" boolean NULL,
      ADD COLUMN IF NOT EXISTS "c4_auto_on_full_sync" boolean NULL,
      ADD COLUMN IF NOT EXISTS "c4_archify_bin" varchar(512) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "c4_archify_bin",
      DROP COLUMN IF EXISTS "c4_auto_on_full_sync",
      DROP COLUMN IF EXISTS "c4_enabled"
    `);
  }
}
