import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ops_settings" ADD COLUMN "work_rules_report_deadline" varchar DEFAULT '18:00';
  ALTER TABLE "ops_settings" ADD COLUMN "work_rules_first_follow_up_days" numeric DEFAULT 2;
  ALTER TABLE "ops_settings" ADD COLUMN "work_rules_second_follow_up_days" numeric DEFAULT 5;
  ALTER TABLE "ops_settings" ADD COLUMN "work_rules_third_follow_up_days" numeric DEFAULT 10;
  ALTER TABLE "ops_settings" ADD COLUMN "work_rules_reminders_follow_ups" boolean DEFAULT true;
  ALTER TABLE "ops_settings" ADD COLUMN "work_rules_reminders_tasks_due" boolean DEFAULT true;
  ALTER TABLE "ops_settings" ADD COLUMN "work_rules_reminders_report_due" boolean DEFAULT true;
  ALTER TABLE "ops_settings" ADD COLUMN "work_rules_reminders_report_missing" boolean DEFAULT true;
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_work_rules_report_deadline" varchar DEFAULT '18:00';
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_work_rules_first_follow_up_days" numeric DEFAULT 2;
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_work_rules_second_follow_up_days" numeric DEFAULT 5;
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_work_rules_third_follow_up_days" numeric DEFAULT 10;
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_work_rules_reminders_follow_ups" boolean DEFAULT true;
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_work_rules_reminders_tasks_due" boolean DEFAULT true;
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_work_rules_reminders_report_due" boolean DEFAULT true;
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_work_rules_reminders_report_missing" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ops_settings" DROP COLUMN "work_rules_report_deadline";
  ALTER TABLE "ops_settings" DROP COLUMN "work_rules_first_follow_up_days";
  ALTER TABLE "ops_settings" DROP COLUMN "work_rules_second_follow_up_days";
  ALTER TABLE "ops_settings" DROP COLUMN "work_rules_third_follow_up_days";
  ALTER TABLE "ops_settings" DROP COLUMN "work_rules_reminders_follow_ups";
  ALTER TABLE "ops_settings" DROP COLUMN "work_rules_reminders_tasks_due";
  ALTER TABLE "ops_settings" DROP COLUMN "work_rules_reminders_report_due";
  ALTER TABLE "ops_settings" DROP COLUMN "work_rules_reminders_report_missing";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_work_rules_report_deadline";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_work_rules_first_follow_up_days";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_work_rules_second_follow_up_days";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_work_rules_third_follow_up_days";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_work_rules_reminders_follow_ups";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_work_rules_reminders_tasks_due";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_work_rules_reminders_report_due";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_work_rules_reminders_report_missing";`)
}
