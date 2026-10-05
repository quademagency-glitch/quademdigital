import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_notify_by" AS ENUM('now', 'digest', 'portal');
  CREATE TYPE "public"."enum_channels_kind" AS ENUM('everyone', 'role', 'direct');
  CREATE TYPE "public"."enum_polls_status" AS ENUM('draft', 'open', 'closed');
  CREATE TYPE "public"."enum_polls_audience" AS ENUM('everyone', 'people');
  CREATE TABLE "channels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar,
  	"kind" "enum_channels_kind" NOT NULL,
  	"job_role_id" integer,
  	"last_message_at" timestamp(3) with time zone,
  	"last_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "channels_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"channel_id" integer NOT NULL,
  	"author_id" integer,
  	"body" varchar,
  	"attachment_id" integer,
  	"edited_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "channel_reads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"channel_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"read_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "polls_choices" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "polls" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"details" varchar,
  	"status" "enum_polls_status" DEFAULT 'draft' NOT NULL,
  	"audience" "enum_polls_audience" DEFAULT 'everyone' NOT NULL,
  	"closes_at" timestamp(3) with time zone,
  	"anonymous" boolean DEFAULT false,
  	"opened_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "polls_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "poll_votes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"poll_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"choice" varchar NOT NULL,
  	"at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "confirmations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"announcement_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "notify_by" "enum_users_notify_by" DEFAULT 'now';
  ALTER TABLE "announcements" ADD COLUMN "must_confirm" boolean DEFAULT false;
  ALTER TABLE "notifications" ADD COLUMN "digest" boolean DEFAULT false;
  ALTER TABLE "documents" ADD COLUMN "channel_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "channels_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "messages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "channel_reads_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "polls_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "poll_votes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "confirmations_id" integer;
  ALTER TABLE "channels" ADD CONSTRAINT "channels_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "channels_rels" ADD CONSTRAINT "channels_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "channels_rels" ADD CONSTRAINT "channels_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_attachment_id_documents_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "channel_reads" ADD CONSTRAINT "channel_reads_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "channel_reads" ADD CONSTRAINT "channel_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "polls_choices" ADD CONSTRAINT "polls_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "polls_rels" ADD CONSTRAINT "polls_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "polls_rels" ADD CONSTRAINT "polls_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "channels_key_idx" ON "channels" USING btree ("key");
  CREATE INDEX "channels_kind_idx" ON "channels" USING btree ("kind");
  CREATE INDEX "channels_job_role_idx" ON "channels" USING btree ("job_role_id");
  CREATE INDEX "channels_last_message_at_idx" ON "channels" USING btree ("last_message_at");
  CREATE INDEX "channels_updated_at_idx" ON "channels" USING btree ("updated_at");
  CREATE INDEX "channels_created_at_idx" ON "channels" USING btree ("created_at");
  CREATE INDEX "channels_rels_order_idx" ON "channels_rels" USING btree ("order");
  CREATE INDEX "channels_rels_parent_idx" ON "channels_rels" USING btree ("parent_id");
  CREATE INDEX "channels_rels_path_idx" ON "channels_rels" USING btree ("path");
  CREATE INDEX "channels_rels_users_id_idx" ON "channels_rels" USING btree ("users_id");
  CREATE INDEX "messages_channel_idx" ON "messages" USING btree ("channel_id");
  CREATE INDEX "messages_author_idx" ON "messages" USING btree ("author_id");
  CREATE INDEX "messages_attachment_idx" ON "messages" USING btree ("attachment_id");
  CREATE INDEX "messages_updated_at_idx" ON "messages" USING btree ("updated_at");
  CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");
  CREATE UNIQUE INDEX "channel_reads_key_idx" ON "channel_reads" USING btree ("key");
  CREATE INDEX "channel_reads_channel_idx" ON "channel_reads" USING btree ("channel_id");
  CREATE INDEX "channel_reads_user_idx" ON "channel_reads" USING btree ("user_id");
  CREATE INDEX "channel_reads_updated_at_idx" ON "channel_reads" USING btree ("updated_at");
  CREATE INDEX "channel_reads_created_at_idx" ON "channel_reads" USING btree ("created_at");
  CREATE INDEX "polls_choices_order_idx" ON "polls_choices" USING btree ("_order");
  CREATE INDEX "polls_choices_parent_id_idx" ON "polls_choices" USING btree ("_parent_id");
  CREATE INDEX "polls_status_idx" ON "polls" USING btree ("status");
  CREATE INDEX "polls_updated_at_idx" ON "polls" USING btree ("updated_at");
  CREATE INDEX "polls_created_at_idx" ON "polls" USING btree ("created_at");
  CREATE INDEX "polls_rels_order_idx" ON "polls_rels" USING btree ("order");
  CREATE INDEX "polls_rels_parent_idx" ON "polls_rels" USING btree ("parent_id");
  CREATE INDEX "polls_rels_path_idx" ON "polls_rels" USING btree ("path");
  CREATE INDEX "polls_rels_users_id_idx" ON "polls_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "poll_votes_key_idx" ON "poll_votes" USING btree ("key");
  CREATE INDEX "poll_votes_poll_idx" ON "poll_votes" USING btree ("poll_id");
  CREATE INDEX "poll_votes_user_idx" ON "poll_votes" USING btree ("user_id");
  CREATE INDEX "poll_votes_updated_at_idx" ON "poll_votes" USING btree ("updated_at");
  CREATE INDEX "poll_votes_created_at_idx" ON "poll_votes" USING btree ("created_at");
  CREATE UNIQUE INDEX "confirmations_key_idx" ON "confirmations" USING btree ("key");
  CREATE INDEX "confirmations_announcement_idx" ON "confirmations" USING btree ("announcement_id");
  CREATE INDEX "confirmations_user_idx" ON "confirmations" USING btree ("user_id");
  CREATE INDEX "confirmations_updated_at_idx" ON "confirmations" USING btree ("updated_at");
  CREATE INDEX "confirmations_created_at_idx" ON "confirmations" USING btree ("created_at");
  ALTER TABLE "documents" ADD CONSTRAINT "documents_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_channels_fk" FOREIGN KEY ("channels_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_messages_fk" FOREIGN KEY ("messages_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_channel_reads_fk" FOREIGN KEY ("channel_reads_id") REFERENCES "public"."channel_reads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_polls_fk" FOREIGN KEY ("polls_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_poll_votes_fk" FOREIGN KEY ("poll_votes_id") REFERENCES "public"."poll_votes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_confirmations_fk" FOREIGN KEY ("confirmations_id") REFERENCES "public"."confirmations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "notifications_digest_idx" ON "notifications" USING btree ("digest");
  CREATE INDEX "documents_channel_idx" ON "documents" USING btree ("channel_id");
  CREATE INDEX "payload_locked_documents_rels_channels_id_idx" ON "payload_locked_documents_rels" USING btree ("channels_id");
  CREATE INDEX "payload_locked_documents_rels_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("messages_id");
  CREATE INDEX "payload_locked_documents_rels_channel_reads_id_idx" ON "payload_locked_documents_rels" USING btree ("channel_reads_id");
  CREATE INDEX "payload_locked_documents_rels_polls_id_idx" ON "payload_locked_documents_rels" USING btree ("polls_id");
  CREATE INDEX "payload_locked_documents_rels_poll_votes_id_idx" ON "payload_locked_documents_rels" USING btree ("poll_votes_id");
  CREATE INDEX "payload_locked_documents_rels_confirmations_id_idx" ON "payload_locked_documents_rels" USING btree ("confirmations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "channels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "channels_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "channel_reads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "polls_choices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "polls" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "polls_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "poll_votes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "confirmations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "channels" CASCADE;
  DROP TABLE "channels_rels" CASCADE;
  DROP TABLE "messages" CASCADE;
  DROP TABLE "channel_reads" CASCADE;
  DROP TABLE "polls_choices" CASCADE;
  DROP TABLE "polls" CASCADE;
  DROP TABLE "polls_rels" CASCADE;
  DROP TABLE "poll_votes" CASCADE;
  DROP TABLE "confirmations" CASCADE;
  ALTER TABLE "documents" DROP CONSTRAINT "documents_channel_id_channels_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_channels_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_messages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_channel_reads_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_polls_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_poll_votes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_confirmations_fk";
  
  DROP INDEX "notifications_digest_idx";
  DROP INDEX "documents_channel_idx";
  DROP INDEX "payload_locked_documents_rels_channels_id_idx";
  DROP INDEX "payload_locked_documents_rels_messages_id_idx";
  DROP INDEX "payload_locked_documents_rels_channel_reads_id_idx";
  DROP INDEX "payload_locked_documents_rels_polls_id_idx";
  DROP INDEX "payload_locked_documents_rels_poll_votes_id_idx";
  DROP INDEX "payload_locked_documents_rels_confirmations_id_idx";
  ALTER TABLE "users" DROP COLUMN "notify_by";
  ALTER TABLE "announcements" DROP COLUMN "must_confirm";
  ALTER TABLE "notifications" DROP COLUMN "digest";
  ALTER TABLE "documents" DROP COLUMN "channel_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "channels_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "messages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "channel_reads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "polls_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "poll_votes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "confirmations_id";
  DROP TYPE "public"."enum_users_notify_by";
  DROP TYPE "public"."enum_channels_kind";
  DROP TYPE "public"."enum_polls_status";
  DROP TYPE "public"."enum_polls_audience";`)
}
