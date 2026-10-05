import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "profile_photos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer NOT NULL,
  	"prefix" varchar DEFAULT 'profile-photos',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric
  );
  
  ALTER TABLE "users" ADD COLUMN "profile_photo_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "profile_photos_id" integer;
  ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "profile_photos_owner_idx" ON "profile_photos" USING btree ("owner_id");
  CREATE INDEX "profile_photos_updated_at_idx" ON "profile_photos" USING btree ("updated_at");
  CREATE INDEX "profile_photos_created_at_idx" ON "profile_photos" USING btree ("created_at");
  CREATE UNIQUE INDEX "profile_photos_filename_idx" ON "profile_photos" USING btree ("filename");
  ALTER TABLE "users" ADD CONSTRAINT "users_profile_photo_id_profile_photos_id_fk" FOREIGN KEY ("profile_photo_id") REFERENCES "public"."profile_photos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_profile_photos_fk" FOREIGN KEY ("profile_photos_id") REFERENCES "public"."profile_photos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_profile_photo_idx" ON "users" USING btree ("profile_photo_id");
  CREATE INDEX "payload_locked_documents_rels_profile_photos_id_idx" ON "payload_locked_documents_rels" USING btree ("profile_photos_id");`)
}

export async function down({}: MigrateDownArgs): Promise<void> {
  // Retain additive photo data on an application rollback.
  throw new Error('Profile photos are retained. Roll back the application without reverting this migration.')
}
