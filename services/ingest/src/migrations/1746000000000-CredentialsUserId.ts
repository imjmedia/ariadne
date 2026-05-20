import { MigrationInterface, QueryRunner } from 'typeorm';

export class CredentialsUserId1746000000000 implements MigrationInterface {
  name = 'CredentialsUserId1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "credentials"
      ADD COLUMN "user_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_credentials_user_provider"
      ON "credentials" ("user_id", "provider")
    `);
    await queryRunner.query(`
      ALTER TABLE "credentials"
      ADD CONSTRAINT "FK_credentials_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credentials" DROP CONSTRAINT "FK_credentials_user"`);
    await queryRunner.query(`DROP INDEX "IDX_credentials_user_provider"`);
    await queryRunner.query(`ALTER TABLE "credentials" DROP COLUMN "user_id"`);
  }
}
