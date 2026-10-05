import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "trusted_devices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"user_id" numeric NOT NULL,
  	"credential_hash" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"last_used_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "device_sessions" ADD COLUMN "trusted_device_id" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trusted_devices_id" integer;
  CREATE UNIQUE INDEX "trusted_devices_token_hash_idx" ON "trusted_devices" USING btree ("token_hash");
  CREATE INDEX "trusted_devices_user_id_idx" ON "trusted_devices" USING btree ("user_id");
  CREATE INDEX "trusted_devices_expires_at_idx" ON "trusted_devices" USING btree ("expires_at");
  CREATE INDEX "trusted_devices_updated_at_idx" ON "trusted_devices" USING btree ("updated_at");
  CREATE INDEX "trusted_devices_created_at_idx" ON "trusted_devices" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trusted_devices_fk" FOREIGN KEY ("trusted_devices_id") REFERENCES "public"."trusted_devices"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "device_sessions_trusted_device_id_idx" ON "device_sessions" USING btree ("trusted_device_id");
  CREATE INDEX "payload_locked_documents_rels_trusted_devices_id_idx" ON "payload_locked_documents_rels" USING btree ("trusted_devices_id");
`)
}

/** Keep the additive schema when rolling the application back. */
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Roll back the application while retaining trusted-device records.')
}
