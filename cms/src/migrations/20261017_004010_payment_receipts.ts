import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'paymentReceipt' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'paymentReceipt' BEFORE 'schedulePublish';
  ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "correction_reason" varchar;
  ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "receipt_send" boolean DEFAULT true;
  ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "receipt_number" varchar;
  ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "receipt_sent_at" timestamp(3) with time zone;
  ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "receipt_sent_to" varchar;
  ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "receipt_problem" varchar;
  ALTER TABLE "_client_payments_v" ADD COLUMN IF NOT EXISTS "version_correction_reason" varchar;
  ALTER TABLE "_client_payments_v" ADD COLUMN IF NOT EXISTS "version_receipt_send" boolean DEFAULT true;
  ALTER TABLE "_client_payments_v" ADD COLUMN IF NOT EXISTS "version_receipt_number" varchar;
  ALTER TABLE "_client_payments_v" ADD COLUMN IF NOT EXISTS "version_receipt_sent_at" timestamp(3) with time zone;
  ALTER TABLE "_client_payments_v" ADD COLUMN IF NOT EXISTS "version_receipt_sent_to" varchar;
  ALTER TABLE "_client_payments_v" ADD COLUMN IF NOT EXISTS "version_receipt_problem" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'operationsHealth', 'clientOnboarding', 'teamReminders', 'recordInvoicePayment', 'signingRounds', 'sendAgreementForSigning', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'operationsHealth', 'clientOnboarding', 'teamReminders', 'recordInvoicePayment', 'signingRounds', 'sendAgreementForSigning', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  ALTER TABLE "client_payments" DROP COLUMN "correction_reason";
  ALTER TABLE "client_payments" DROP COLUMN "receipt_send";
  ALTER TABLE "client_payments" DROP COLUMN "receipt_number";
  ALTER TABLE "client_payments" DROP COLUMN "receipt_sent_at";
  ALTER TABLE "client_payments" DROP COLUMN "receipt_sent_to";
  ALTER TABLE "client_payments" DROP COLUMN "receipt_problem";
  ALTER TABLE "_client_payments_v" DROP COLUMN "version_correction_reason";
  ALTER TABLE "_client_payments_v" DROP COLUMN "version_receipt_send";
  ALTER TABLE "_client_payments_v" DROP COLUMN "version_receipt_number";
  ALTER TABLE "_client_payments_v" DROP COLUMN "version_receipt_sent_at";
  ALTER TABLE "_client_payments_v" DROP COLUMN "version_receipt_sent_to";
  ALTER TABLE "_client_payments_v" DROP COLUMN "version_receipt_problem";`)
}
