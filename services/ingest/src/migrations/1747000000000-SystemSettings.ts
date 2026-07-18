import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SystemSettings1747000000000 implements MigrationInterface {
  name = 'SystemSettings1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "id" varchar(32) NOT NULL DEFAULT 'default',
        "cors_origin" varchar(1024) NULL,
        "email_otp" varchar(320) NULL,
        "sso_url" varchar(512) NULL,
        "web_app_host" varchar(256) NULL,
        "smtp_host" varchar(256) NULL,
        "smtp_port" int NULL,
        "smtp_user" varchar(320) NULL,
        "smtp_pass_encrypted" text NULL,
        "smtp_from" varchar(320) NULL,
        "falkor_shard_by_project" boolean NULL,
        "falkor_shard_by_domain" boolean NULL,
        "falkor_auto_domain_overflow" boolean NULL,
        "falkor_graph_node_soft_limit" int NULL,
        "falkor_debug_cypher" boolean NULL,
        "metrics_enabled" boolean NULL,
        "chat_telemetry_log" boolean NULL,
        "chat_two_phase" boolean NULL,
        "modification_plan_max_files" int NULL,
        "ollama_base_url" varchar(512) NULL,
        "ollama_embed_model" varchar(128) NULL,
        "github_token_encrypted" text NULL,
        "updated_by" varchar(64) NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_settings" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "system_settings"`);
  }
}
