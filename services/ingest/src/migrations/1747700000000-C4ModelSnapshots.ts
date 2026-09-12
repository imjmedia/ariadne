import type { MigrationInterface, QueryRunner } from 'typeorm';

export class C4ModelSnapshots1747700000000 implements MigrationInterface {
  name = 'C4ModelSnapshots1747700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "c4_model_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "repo_id" uuid,
        "level" character varying(32) NOT NULL,
        "model_json" jsonb NOT NULL,
        "archify_json" jsonb,
        "archify_html_path" text,
        "content_hash" character varying(64) NOT NULL,
        "generator" character varying(16) NOT NULL DEFAULT 'sync',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c4_model_snapshots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_c4_model_snapshots_project_level"
      ON "c4_model_snapshots" ("project_id", "level", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "c4_model_snapshots"`);
  }
}
