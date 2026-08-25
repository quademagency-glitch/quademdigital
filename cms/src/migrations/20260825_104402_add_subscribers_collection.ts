import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_subscribers_interests" AS ENUM('general', 'seo', 'web-design', 'brand-identity', 'video');
  CREATE TYPE "public"."enum_subscribers_status" AS ENUM('pending', 'subscribed', 'unsubscribed', 'bounced', 'complained');
  CREATE TYPE "public"."enum_subscribers_source" AS ENUM('newsletter', 'contact-form', 'lead-magnet', 'client', 'import', 'manual', 'other');
  CREATE TYPE "public"."enum__subscribers_v_version_interests" AS ENUM('general', 'seo', 'web-design', 'brand-identity', 'video');
  CREATE TYPE "public"."enum__subscribers_v_version_status" AS ENUM('pending', 'subscribed', 'unsubscribed', 'bounced', 'complained');
  CREATE TYPE "public"."enum__subscribers_v_version_source" AS ENUM('newsletter', 'contact-form', 'lead-magnet', 'client', 'import', 'manual', 'other');
  CREATE TABLE "subscribers_interests" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_subscribers_interests",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "subscribers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"status" "enum_subscribers_status" DEFAULT 'subscribed' NOT NULL,
  	"source" "enum_subscribers_source" DEFAULT 'other',
  	"source_detail" varchar,
  	"consent_at" timestamp(3) with time zone,
  	"confirmed_at" timestamp(3) with time zone,
  	"unsubscribed_at" timestamp(3) with time zone,
  	"last_email_at" timestamp(3) with time zone,
  	"delivery_last_event" varchar,
  	"delivery_last_event_at" timestamp(3) with time zone,
  	"delivery_detail" varchar,
  	"unsubscribe_token" varchar,
  	"resend_contact_id" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_subscribers_v_version_interests" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__subscribers_v_version_interests",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_subscribers_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_email" varchar NOT NULL,
  	"version_name" varchar,
  	"version_status" "enum__subscribers_v_version_status" DEFAULT 'subscribed' NOT NULL,
  	"version_source" "enum__subscribers_v_version_source" DEFAULT 'other',
  	"version_source_detail" varchar,
  	"version_consent_at" timestamp(3) with time zone,
  	"version_confirmed_at" timestamp(3) with time zone,
  	"version_unsubscribed_at" timestamp(3) with time zone,
  	"version_last_email_at" timestamp(3) with time zone,
  	"version_delivery_last_event" varchar,
  	"version_delivery_last_event_at" timestamp(3) with time zone,
  	"version_delivery_detail" varchar,
  	"version_unsubscribe_token" varchar,
  	"version_resend_contact_id" varchar,
  	"version_notes" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscribers_id" integer;
  ALTER TABLE "subscribers_interests" ADD CONSTRAINT "subscribers_interests_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_subscribers_v_version_interests" ADD CONSTRAINT "_subscribers_v_version_interests_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_subscribers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_subscribers_v" ADD CONSTRAINT "_subscribers_v_parent_id_subscribers_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "subscribers_interests_order_idx" ON "subscribers_interests" USING btree ("order");
  CREATE INDEX "subscribers_interests_parent_idx" ON "subscribers_interests" USING btree ("parent_id");
  CREATE UNIQUE INDEX "subscribers_email_idx" ON "subscribers" USING btree ("email");
  CREATE INDEX "subscribers_status_idx" ON "subscribers" USING btree ("status");
  CREATE UNIQUE INDEX "subscribers_unsubscribe_token_idx" ON "subscribers" USING btree ("unsubscribe_token");
  CREATE INDEX "subscribers_updated_at_idx" ON "subscribers" USING btree ("updated_at");
  CREATE INDEX "subscribers_created_at_idx" ON "subscribers" USING btree ("created_at");
  CREATE INDEX "_subscribers_v_version_interests_order_idx" ON "_subscribers_v_version_interests" USING btree ("order");
  CREATE INDEX "_subscribers_v_version_interests_parent_idx" ON "_subscribers_v_version_interests" USING btree ("parent_id");
  CREATE INDEX "_subscribers_v_parent_idx" ON "_subscribers_v" USING btree ("parent_id");
  CREATE INDEX "_subscribers_v_version_version_email_idx" ON "_subscribers_v" USING btree ("version_email");
  CREATE INDEX "_subscribers_v_version_version_status_idx" ON "_subscribers_v" USING btree ("version_status");
  CREATE INDEX "_subscribers_v_version_version_unsubscribe_token_idx" ON "_subscribers_v" USING btree ("version_unsubscribe_token");
  CREATE INDEX "_subscribers_v_version_version_updated_at_idx" ON "_subscribers_v" USING btree ("version_updated_at");
  CREATE INDEX "_subscribers_v_version_version_created_at_idx" ON "_subscribers_v" USING btree ("version_created_at");
  CREATE INDEX "_subscribers_v_created_at_idx" ON "_subscribers_v" USING btree ("created_at");
  CREATE INDEX "_subscribers_v_updated_at_idx" ON "_subscribers_v" USING btree ("updated_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscribers_fk" FOREIGN KEY ("subscribers_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("subscribers_id");`)
}

/*
  The generator's own `down()` could not run twice, and could not run once
  either. Dropping "subscribers" with CASCADE also drops
  payload_locked_documents_rels_subscribers_fk, because that constraint
  references it, and the next statement then tried to drop the same constraint
  by name and errored. Same trap as the media folders migration on 2026-08-24:
  a generated down() is not automatically correct, and it is only found by
  rehearsing the rollback rather than just the apply. IF EXISTS throughout.
*/
export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "subscribers_interests" CASCADE;
  DROP TABLE IF EXISTS "_subscribers_v_version_interests" CASCADE;
  DROP TABLE IF EXISTS "_subscribers_v" CASCADE;
  DROP TABLE IF EXISTS "subscribers" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_subscribers_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_subscribers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "subscribers_id";
  DROP TYPE IF EXISTS "public"."enum_subscribers_interests";
  DROP TYPE IF EXISTS "public"."enum_subscribers_status";
  DROP TYPE IF EXISTS "public"."enum_subscribers_source";
  DROP TYPE IF EXISTS "public"."enum__subscribers_v_version_interests";
  DROP TYPE IF EXISTS "public"."enum__subscribers_v_version_status";
  DROP TYPE IF EXISTS "public"."enum__subscribers_v_version_source";`)
}
