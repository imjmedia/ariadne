import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectTheForgeLink1747100000000 implements MigrationInterface {
  name = 'ProjectTheForgeLink1747100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "theforge_project_id" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "theforge_project_name" varchar(512) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects" DROP COLUMN IF EXISTS "theforge_project_name"
    `);
    await queryRunner.query(`
      ALTER TABLE "projects" DROP COLUMN IF EXISTS "theforge_project_id"
    `);
  }
}
