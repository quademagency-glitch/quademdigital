import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "monthly_reviews" ADD COLUMN "reviewer_agreed_by_id" integer;
  ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_reviewer_agreed_by_id_users_id_fk" FOREIGN KEY ("reviewer_agreed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "monthly_reviews_reviewer_agreed_by_idx" ON "monthly_reviews" USING btree ("reviewer_agreed_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "monthly_reviews" DROP CONSTRAINT "monthly_reviews_reviewer_agreed_by_id_users_id_fk";
  
  DROP INDEX "monthly_reviews_reviewer_agreed_by_idx";
  ALTER TABLE "monthly_reviews" DROP COLUMN "reviewer_agreed_by_id";`)
}
