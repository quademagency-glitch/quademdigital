import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'operationsHealth' BEFORE 'clientOnboarding';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'operationsHealth' BEFORE 'clientOnboarding';
  CREATE TABLE "security_challenges" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"challenge" varchar NOT NULL,
  	"bucket" varchar NOT NULL,
  	"user_id" numeric NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "device_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sid" varchar NOT NULL,
  	"user_id" numeric NOT NULL,
  	"label" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"endpoint_hash" varchar NOT NULL,
  	"user_id" numeric NOT NULL,
  	"sid" varchar NOT NULL,
  	"subscription" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "offline_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"user_id" numeric NOT NULL,
  	"kind" varchar NOT NULL,
  	"input_hash" varchar NOT NULL,
  	"record_id" numeric,
  	"path" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "operations_health" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "two_step" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "security_challenges_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "device_sessions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_subscriptions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "offline_submissions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "operations_health_id" integer;
  CREATE UNIQUE INDEX "security_challenges_challenge_idx" ON "security_challenges" USING btree ("challenge");
  CREATE UNIQUE INDEX "security_challenges_bucket_idx" ON "security_challenges" USING btree ("bucket");
  CREATE INDEX "security_challenges_user_id_idx" ON "security_challenges" USING btree ("user_id");
  CREATE INDEX "security_challenges_expires_at_idx" ON "security_challenges" USING btree ("expires_at");
  CREATE INDEX "security_challenges_updated_at_idx" ON "security_challenges" USING btree ("updated_at");
  CREATE INDEX "security_challenges_created_at_idx" ON "security_challenges" USING btree ("created_at");
  CREATE UNIQUE INDEX "device_sessions_sid_idx" ON "device_sessions" USING btree ("sid");
  CREATE INDEX "device_sessions_user_id_idx" ON "device_sessions" USING btree ("user_id");
  CREATE INDEX "device_sessions_expires_at_idx" ON "device_sessions" USING btree ("expires_at");
  CREATE INDEX "device_sessions_updated_at_idx" ON "device_sessions" USING btree ("updated_at");
  CREATE INDEX "device_sessions_created_at_idx" ON "device_sessions" USING btree ("created_at");
  CREATE UNIQUE INDEX "push_subscriptions_endpoint_hash_idx" ON "push_subscriptions" USING btree ("endpoint_hash");
  CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");
  CREATE INDEX "push_subscriptions_sid_idx" ON "push_subscriptions" USING btree ("sid");
  CREATE INDEX "push_subscriptions_updated_at_idx" ON "push_subscriptions" USING btree ("updated_at");
  CREATE INDEX "push_subscriptions_created_at_idx" ON "push_subscriptions" USING btree ("created_at");
  CREATE UNIQUE INDEX "offline_submissions_key_idx" ON "offline_submissions" USING btree ("key");
  CREATE INDEX "offline_submissions_user_id_idx" ON "offline_submissions" USING btree ("user_id");
  CREATE INDEX "offline_submissions_updated_at_idx" ON "offline_submissions" USING btree ("updated_at");
  CREATE INDEX "offline_submissions_created_at_idx" ON "offline_submissions" USING btree ("created_at");
  CREATE UNIQUE INDEX "operations_health_key_idx" ON "operations_health" USING btree ("key");
  CREATE INDEX "operations_health_updated_at_idx" ON "operations_health" USING btree ("updated_at");
  CREATE INDEX "operations_health_created_at_idx" ON "operations_health" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_security_challenges_fk" FOREIGN KEY ("security_challenges_id") REFERENCES "public"."security_challenges"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_device_sessions_fk" FOREIGN KEY ("device_sessions_id") REFERENCES "public"."device_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_offline_submissions_fk" FOREIGN KEY ("offline_submissions_id") REFERENCES "public"."offline_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_operations_health_fk" FOREIGN KEY ("operations_health_id") REFERENCES "public"."operations_health"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_security_challenges_id_idx" ON "payload_locked_documents_rels" USING btree ("security_challenges_id");
  CREATE INDEX "payload_locked_documents_rels_device_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("device_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_offline_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("offline_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_operations_health_id_idx" ON "payload_locked_documents_rels" USING btree ("operations_health_id");`)
}

/** Retain security records on app rollback. Removing them is a separate, reviewed operation. */
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Revert the application while keeping this additive schema. Security and draft receipts must not be discarded.')
}
