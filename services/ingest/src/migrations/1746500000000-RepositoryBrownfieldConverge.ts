import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RepositoryBrownfieldConverge1746500000000 implements MigrationInterface {
  name = 'RepositoryBrownfieldConverge1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "repositories"
      ADD COLUMN IF NOT EXISTS "theforge_project_id" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories"
      ADD COLUMN IF NOT EXISTS "theforge_stage_id" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories"
      ADD COLUMN IF NOT EXISTS "theforge_converge_persist" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories"
      ADD COLUMN IF NOT EXISTS "theforge_converge_trigger_mode" varchar(16) NOT NULL DEFAULT 'off'
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories"
      ADD COLUMN IF NOT EXISTS "theforge_service_token_encrypted" varchar(1024) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "repositories" DROP COLUMN IF EXISTS "theforge_service_token_encrypted"
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories" DROP COLUMN IF EXISTS "theforge_converge_trigger_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories" DROP COLUMN IF EXISTS "theforge_converge_persist"
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories" DROP COLUMN IF EXISTS "theforge_stage_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories" DROP COLUMN IF EXISTS "theforge_project_id"
    `);
  }
}
