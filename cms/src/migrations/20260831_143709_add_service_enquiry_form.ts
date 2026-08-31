import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_services_enquiry_form_questions_input_type" AS ENUM('choice', 'text', 'longtext');
  CREATE TABLE "services_enquiry_form_questions_choices" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"choice" varchar
  );
  
  CREATE TABLE "services_enquiry_form_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"key" varchar,
  	"input_type" "enum_services_enquiry_form_questions_input_type" DEFAULT 'choice',
  	"required" boolean DEFAULT true,
  	"placeholder" varchar
  );
  
  ALTER TABLE "services" ADD COLUMN "enquiry_form_heading" varchar;
  ALTER TABLE "services" ADD COLUMN "enquiry_form_intro" varchar;
  ALTER TABLE "services" ADD COLUMN "enquiry_form_questions_heading" varchar;
  ALTER TABLE "services" ADD COLUMN "enquiry_form_button_label" varchar;
  ALTER TABLE "services_enquiry_form_questions_choices" ADD CONSTRAINT "services_enquiry_form_questions_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services_enquiry_form_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_enquiry_form_questions" ADD CONSTRAINT "services_enquiry_form_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "services_enquiry_form_questions_choices_order_idx" ON "services_enquiry_form_questions_choices" USING btree ("_order");
  CREATE INDEX "services_enquiry_form_questions_choices_parent_id_idx" ON "services_enquiry_form_questions_choices" USING btree ("_parent_id");
  CREATE INDEX "services_enquiry_form_questions_order_idx" ON "services_enquiry_form_questions" USING btree ("_order");
  CREATE INDEX "services_enquiry_form_questions_parent_id_idx" ON "services_enquiry_form_questions" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "services_enquiry_form_questions_choices" CASCADE;
  DROP TABLE "services_enquiry_form_questions" CASCADE;
  ALTER TABLE "services" DROP COLUMN "enquiry_form_heading";
  ALTER TABLE "services" DROP COLUMN "enquiry_form_intro";
  ALTER TABLE "services" DROP COLUMN "enquiry_form_questions_heading";
  ALTER TABLE "services" DROP COLUMN "enquiry_form_button_label";
  DROP TYPE "public"."enum_services_enquiry_form_questions_input_type";`)
}
