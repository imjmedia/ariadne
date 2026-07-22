import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPasswordHash1747100000000 implements MigrationInterface {
  name = 'UserPasswordHash1747100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "password_hash" character varying(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash"
    `);
  }
}
