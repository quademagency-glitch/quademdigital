import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "channel_createdAt_idx" ON "messages" USING btree ("channel_id","created_at");
  CREATE INDEX IF NOT EXISTS "leads_activity_recorded_at_idx" ON "leads_activity" USING btree ("recorded_at");
  CREATE INDEX IF NOT EXISTS "leads_activity_counts_on_idx" ON "leads_activity" USING btree ("counts_on");
  CREATE INDEX IF NOT EXISTS "leads_source_idx" ON "leads" USING btree ("source");
  CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "_leads_v_version_activity_recorded_at_idx" ON "_leads_v_version_activity" USING btree ("recorded_at");
  CREATE INDEX IF NOT EXISTS "_leads_v_version_activity_counts_on_idx" ON "_leads_v_version_activity" USING btree ("counts_on");
  CREATE INDEX IF NOT EXISTS "_leads_v_version_version_source_idx" ON "_leads_v" USING btree ("version_source");
  CREATE INDEX IF NOT EXISTS "_leads_v_version_version_status_idx" ON "_leads_v" USING btree ("version_status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "channel_createdAt_idx";
  DROP INDEX IF EXISTS "leads_activity_recorded_at_idx";
  DROP INDEX IF EXISTS "leads_activity_counts_on_idx";
  DROP INDEX IF EXISTS "leads_source_idx";
  DROP INDEX IF EXISTS "leads_status_idx";
  DROP INDEX IF EXISTS "_leads_v_version_activity_recorded_at_idx";
  DROP INDEX IF EXISTS "_leads_v_version_activity_counts_on_idx";
  DROP INDEX IF EXISTS "_leads_v_version_version_source_idx";
  DROP INDEX IF EXISTS "_leads_v_version_version_status_idx";`)
}
