import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MddPersistenceAndIndexPresets1746700000000 implements MigrationInterface {
  name = 'MddPersistenceAndIndexPresets1746700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "repositories"
      ADD COLUMN IF NOT EXISTS "auto_mdd_on_full_sync" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories"
      ADD COLUMN IF NOT EXISTS "index_tests_enabled" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "repository_mdd_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "repository_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "commit_sha" varchar(64) NULL,
        "mdd_json" jsonb NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_repository_mdd_snapshots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mdd_snapshots_repo_created"
      ON "repository_mdd_snapshots" ("repository_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mdd_snapshots_repo_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "repository_mdd_snapshots"`);
    await queryRunner.query(`
      ALTER TABLE "repositories" DROP COLUMN IF EXISTS "index_tests_enabled"
    `);
    await queryRunner.query(`
      ALTER TABLE "repositories" DROP COLUMN IF EXISTS "auto_mdd_on_full_sync"
    `);
  }
}
