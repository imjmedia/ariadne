import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TheForgeIntegrationSettings1746910000000 implements MigrationInterface {
  name = 'TheForgeIntegrationSettings1746910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "theforge_integration_settings" (
        "id" varchar(32) NOT NULL DEFAULT 'default',
        "enabled" boolean NOT NULL DEFAULT false,
        "api_url" varchar(512) NULL,
        "service_token_encrypted" text NULL,
        "updated_by" varchar(64) NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_theforge_integration_settings" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "theforge_integration_settings"`);
  }
}
