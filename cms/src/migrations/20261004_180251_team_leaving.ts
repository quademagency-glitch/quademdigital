import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "users_exit_checklist" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL,
  	"done" boolean DEFAULT false,
  	"done_at" timestamp(3) with time zone,
  	"by_id" integer
  );
  
  CREATE TABLE "users_past_agreements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"ended_at" timestamp(3) with time zone,
  	"reason" varchar,
  	"agreement_ref" varchar
  );
  
  ALTER TABLE "users_exit_checklist" ADD CONSTRAINT "users_exit_checklist_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_exit_checklist" ADD CONSTRAINT "users_exit_checklist_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_past_agreements" ADD CONSTRAINT "users_past_agreements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_exit_checklist_order_idx" ON "users_exit_checklist" USING btree ("_order");
  CREATE INDEX "users_exit_checklist_parent_id_idx" ON "users_exit_checklist" USING btree ("_parent_id");
  CREATE INDEX "users_exit_checklist_by_idx" ON "users_exit_checklist" USING btree ("by_id");
  CREATE INDEX "users_past_agreements_order_idx" ON "users_past_agreements" USING btree ("_order");
  CREATE INDEX "users_past_agreements_parent_id_idx" ON "users_past_agreements" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_exit_checklist" CASCADE;
  DROP TABLE "users_past_agreements" CASCADE;`)
}
