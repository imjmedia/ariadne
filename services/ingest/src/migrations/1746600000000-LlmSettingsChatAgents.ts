import { MigrationInterface, QueryRunner } from 'typeorm';

/** Modelos router/worker multi-agente + toggle intent router en Ajustes. */
export class LlmSettingsChatAgents1746600000000 implements MigrationInterface {
  name = 'LlmSettingsChatAgents1746600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "llm_settings"
      ADD COLUMN IF NOT EXISTS "orchestrator_router_model" character varying(256),
      ADD COLUMN IF NOT EXISTS "orchestrator_worker_model" character varying(256),
      ADD COLUMN IF NOT EXISTS "chat_intent_router_enabled" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "llm_settings"
      DROP COLUMN IF EXISTS "orchestrator_router_model",
      DROP COLUMN IF EXISTS "orchestrator_worker_model",
      DROP COLUMN IF EXISTS "chat_intent_router_enabled"
    `);
  }
}
