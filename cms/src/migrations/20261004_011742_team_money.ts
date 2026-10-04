import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_client_payments_costs_category" AS ENUM('advertising', 'hosting', 'outsourced', 'software', 'fees');
  CREATE TYPE "public"."enum_client_payments_method" AS ENUM('paystack', 'bank', 'grey', 'mobile-money', 'cash');
  CREATE TYPE "public"."enum_client_payments_currency" AS ENUM('GHS', 'NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  CREATE TYPE "public"."enum_client_payments_credit_type" AS ENUM('sourced', 'handed');
  CREATE TYPE "public"."enum__client_payments_v_version_costs_category" AS ENUM('advertising', 'hosting', 'outsourced', 'software', 'fees');
  CREATE TYPE "public"."enum__client_payments_v_version_method" AS ENUM('paystack', 'bank', 'grey', 'mobile-money', 'cash');
  CREATE TYPE "public"."enum__client_payments_v_version_currency" AS ENUM('GHS', 'NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  CREATE TYPE "public"."enum__client_payments_v_version_credit_type" AS ENUM('sourced', 'handed');
  CREATE TYPE "public"."enum_payouts_type" AS ENUM('commission', 'allowance', 'salary', 'bonus', 'advance', 'expense');
  CREATE TYPE "public"."enum_payouts_currency" AS ENUM('GHS', 'NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  CREATE TYPE "public"."enum_payouts_method" AS ENUM('grey', 'bank', 'mobile-money', 'cash');
  CREATE TYPE "public"."enum__payouts_v_version_type" AS ENUM('commission', 'allowance', 'salary', 'bonus', 'advance', 'expense');
  CREATE TYPE "public"."enum__payouts_v_version_currency" AS ENUM('GHS', 'NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  CREATE TYPE "public"."enum__payouts_v_version_method" AS ENUM('grey', 'bank', 'mobile-money', 'cash');
  CREATE TYPE "public"."enum_expense_claims_currency" AS ENUM('GHS', 'NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  CREATE TYPE "public"."enum_expense_claims_status" AS ENUM('submitted', 'approved', 'declined', 'paid');
  CREATE TYPE "public"."enum_clients_credit_type" AS ENUM('sourced', 'handed');
  CREATE TYPE "public"."enum__clients_v_version_credit_type" AS ENUM('sourced', 'handed');
  CREATE TYPE "public"."enum_proposals_deal_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'active', 'completed', 'ended');
  CREATE TYPE "public"."enum_proposals_credit_type" AS ENUM('sourced', 'handed');
  CREATE TYPE "public"."enum_proposals_pricing" AS ENUM('package', 'custom');
  CREATE TYPE "public"."enum_ops_settings_exchange_rates_currency" AS ENUM('NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  CREATE TYPE "public"."enum__ops_settings_v_version_exchange_rates_currency" AS ENUM('NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'recordInvoicePayment' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'recordInvoicePayment' BEFORE 'schedulePublish';
  CREATE TABLE "client_payments_costs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" "enum_client_payments_costs_category" NOT NULL,
  	"amount_g_h_s_minor" numeric NOT NULL,
  	"receipt_id" integer,
  	"note" varchar
  );
  
  CREATE TABLE "client_payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"invoice_id" integer,
  	"deal_id" integer,
  	"client_id" integer,
  	"cleared_at" timestamp(3) with time zone NOT NULL,
  	"method" "enum_client_payments_method" DEFAULT 'bank' NOT NULL,
  	"reference" varchar,
  	"currency" "enum_client_payments_currency" DEFAULT 'GHS' NOT NULL,
  	"amount_minor" numeric NOT NULL,
  	"fx_to_g_h_s" numeric,
  	"amount_g_h_s_minor" numeric,
  	"refund_of_id" integer,
  	"notes" varchar,
  	"retainer_month" numeric,
  	"costs_g_h_s_minor" numeric,
  	"net_g_h_s_minor" numeric,
  	"commission_rate" varchar,
  	"commission_g_h_s_minor" numeric,
  	"commission_due_at" timestamp(3) with time zone,
  	"commission_reason" varchar,
  	"credit_to_id" integer,
  	"credit_type" "enum_client_payments_credit_type",
  	"payout_id" integer,
  	"terms_used_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_client_payments_v_version_costs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"category" "enum__client_payments_v_version_costs_category" NOT NULL,
  	"amount_g_h_s_minor" numeric NOT NULL,
  	"receipt_id" integer,
  	"note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_client_payments_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_invoice_id" integer,
  	"version_deal_id" integer,
  	"version_client_id" integer,
  	"version_cleared_at" timestamp(3) with time zone NOT NULL,
  	"version_method" "enum__client_payments_v_version_method" DEFAULT 'bank' NOT NULL,
  	"version_reference" varchar,
  	"version_currency" "enum__client_payments_v_version_currency" DEFAULT 'GHS' NOT NULL,
  	"version_amount_minor" numeric NOT NULL,
  	"version_fx_to_g_h_s" numeric,
  	"version_amount_g_h_s_minor" numeric,
  	"version_refund_of_id" integer,
  	"version_notes" varchar,
  	"version_retainer_month" numeric,
  	"version_costs_g_h_s_minor" numeric,
  	"version_net_g_h_s_minor" numeric,
  	"version_commission_rate" varchar,
  	"version_commission_g_h_s_minor" numeric,
  	"version_commission_due_at" timestamp(3) with time zone,
  	"version_commission_reason" varchar,
  	"version_credit_to_id" integer,
  	"version_credit_type" "enum__client_payments_v_version_credit_type",
  	"version_payout_id" integer,
  	"version_terms_used_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payouts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"user_id" integer NOT NULL,
  	"type" "enum_payouts_type" NOT NULL,
  	"period_month" varchar,
  	"reports_since_last_payment" numeric,
  	"reports_needed" numeric,
  	"eligible" boolean,
  	"override_reason" varchar,
  	"currency" "enum_payouts_currency",
  	"amount_local_minor" numeric,
  	"amount_g_h_s_minor" numeric,
  	"fx_rate" numeric,
  	"paid_at" timestamp(3) with time zone NOT NULL,
  	"method" "enum_payouts_method" DEFAULT 'grey',
  	"reference" varchar,
  	"grey_fee_g_h_s_minor" numeric,
  	"advance_repaid_minor" numeric,
  	"note" varchar,
  	"terms_used_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payouts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"client_payments_id" integer,
  	"expense_claims_id" integer,
  	"documents_id" integer
  );
  
  CREATE TABLE "_payouts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_user_id" integer NOT NULL,
  	"version_type" "enum__payouts_v_version_type" NOT NULL,
  	"version_period_month" varchar,
  	"version_reports_since_last_payment" numeric,
  	"version_reports_needed" numeric,
  	"version_eligible" boolean,
  	"version_override_reason" varchar,
  	"version_currency" "enum__payouts_v_version_currency",
  	"version_amount_local_minor" numeric,
  	"version_amount_g_h_s_minor" numeric,
  	"version_fx_rate" numeric,
  	"version_paid_at" timestamp(3) with time zone NOT NULL,
  	"version_method" "enum__payouts_v_version_method" DEFAULT 'grey',
  	"version_reference" varchar,
  	"version_grey_fee_g_h_s_minor" numeric,
  	"version_advance_repaid_minor" numeric,
  	"version_note" varchar,
  	"version_terms_used_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_payouts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"client_payments_id" integer,
  	"expense_claims_id" integer,
  	"documents_id" integer
  );
  
  CREATE TABLE "expense_claims" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"user_id" integer,
  	"spent_at" timestamp(3) with time zone,
  	"receipt_id" integer,
  	"currency" "enum_expense_claims_currency",
  	"amount_minor" numeric NOT NULL,
  	"status" "enum_expense_claims_status" DEFAULT 'submitted',
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"decision_note" varchar,
  	"payout_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "proposals_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pricing_plans_id" integer
  );
  
  CREATE TABLE "ops_settings_exchange_rates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"currency" "enum_ops_settings_exchange_rates_currency" NOT NULL,
  	"per_g_h_s" numeric NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "ops_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"commission_due_days" numeric DEFAULT 7,
  	"allowance_window_start" numeric DEFAULT 15,
  	"allowance_window_end" numeric DEFAULT 20,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_ops_settings_v_version_exchange_rates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"currency" "enum__ops_settings_v_version_exchange_rates_currency" NOT NULL,
  	"per_g_h_s" numeric NOT NULL,
  	"note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_ops_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_commission_due_days" numeric DEFAULT 7,
  	"version_allowance_window_start" numeric DEFAULT 15,
  	"version_allowance_window_end" numeric DEFAULT 20,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "clients" ADD COLUMN "source_lead_id" integer;
  ALTER TABLE "clients" ADD COLUMN "credit_to_id" integer;
  ALTER TABLE "clients" ADD COLUMN "credit_type" "enum_clients_credit_type";
  ALTER TABLE "_clients_v" ADD COLUMN "version_source_lead_id" integer;
  ALTER TABLE "_clients_v" ADD COLUMN "version_credit_to_id" integer;
  ALTER TABLE "_clients_v" ADD COLUMN "version_credit_type" "enum__clients_v_version_credit_type";
  ALTER TABLE "proposals" ADD COLUMN "lead_id" integer;
  ALTER TABLE "proposals" ADD COLUMN "deal_status" "enum_proposals_deal_status" DEFAULT 'draft';
  ALTER TABLE "proposals" ADD COLUMN "accepted_at" timestamp(3) with time zone;
  ALTER TABLE "proposals" ADD COLUMN "credit_to_id" integer;
  ALTER TABLE "proposals" ADD COLUMN "credit_type" "enum_proposals_credit_type";
  ALTER TABLE "proposals" ADD COLUMN "credit_change_reason" varchar;
  ALTER TABLE "proposals" ADD COLUMN "pricing" "enum_proposals_pricing";
  ALTER TABLE "proposals" ADD COLUMN "started_after_salary" boolean;
  ALTER TABLE "proposals" ADD COLUMN "ended_at" timestamp(3) with time zone;
  ALTER TABLE "invoices" ADD COLUMN "deal_id" integer;
  ALTER TABLE "_invoices_v" ADD COLUMN "version_deal_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "client_payments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payouts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "expense_claims_id" integer;
  ALTER TABLE "client_payments_costs" ADD CONSTRAINT "client_payments_costs_receipt_id_documents_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_payments_costs" ADD CONSTRAINT "client_payments_costs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."client_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_deal_id_proposals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_refund_of_id_client_payments_id_fk" FOREIGN KEY ("refund_of_id") REFERENCES "public"."client_payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_credit_to_id_users_id_fk" FOREIGN KEY ("credit_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_terms_used_id_member_terms_id_fk" FOREIGN KEY ("terms_used_id") REFERENCES "public"."member_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_payments_v_version_costs" ADD CONSTRAINT "_client_payments_v_version_costs_receipt_id_documents_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_payments_v_version_costs" ADD CONSTRAINT "_client_payments_v_version_costs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_client_payments_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_client_payments_v" ADD CONSTRAINT "_client_payments_v_parent_id_client_payments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."client_payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_payments_v" ADD CONSTRAINT "_client_payments_v_version_invoice_id_invoices_id_fk" FOREIGN KEY ("version_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_payments_v" ADD CONSTRAINT "_client_payments_v_version_deal_id_proposals_id_fk" FOREIGN KEY ("version_deal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_payments_v" ADD CONSTRAINT "_client_payments_v_version_client_id_clients_id_fk" FOREIGN KEY ("version_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_payments_v" ADD CONSTRAINT "_client_payments_v_version_refund_of_id_client_payments_id_fk" FOREIGN KEY ("version_refund_of_id") REFERENCES "public"."client_payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_payments_v" ADD CONSTRAINT "_client_payments_v_version_credit_to_id_users_id_fk" FOREIGN KEY ("version_credit_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_payments_v" ADD CONSTRAINT "_client_payments_v_version_payout_id_payouts_id_fk" FOREIGN KEY ("version_payout_id") REFERENCES "public"."payouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_payments_v" ADD CONSTRAINT "_client_payments_v_version_terms_used_id_member_terms_id_fk" FOREIGN KEY ("version_terms_used_id") REFERENCES "public"."member_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payouts" ADD CONSTRAINT "payouts_terms_used_id_member_terms_id_fk" FOREIGN KEY ("terms_used_id") REFERENCES "public"."member_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payouts_rels" ADD CONSTRAINT "payouts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payouts_rels" ADD CONSTRAINT "payouts_rels_client_payments_fk" FOREIGN KEY ("client_payments_id") REFERENCES "public"."client_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payouts_rels" ADD CONSTRAINT "payouts_rels_expense_claims_fk" FOREIGN KEY ("expense_claims_id") REFERENCES "public"."expense_claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payouts_rels" ADD CONSTRAINT "payouts_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_payouts_v" ADD CONSTRAINT "_payouts_v_parent_id_payouts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_payouts_v" ADD CONSTRAINT "_payouts_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_payouts_v" ADD CONSTRAINT "_payouts_v_version_terms_used_id_member_terms_id_fk" FOREIGN KEY ("version_terms_used_id") REFERENCES "public"."member_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_payouts_v_rels" ADD CONSTRAINT "_payouts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_payouts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_payouts_v_rels" ADD CONSTRAINT "_payouts_v_rels_client_payments_fk" FOREIGN KEY ("client_payments_id") REFERENCES "public"."client_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_payouts_v_rels" ADD CONSTRAINT "_payouts_v_rels_expense_claims_fk" FOREIGN KEY ("expense_claims_id") REFERENCES "public"."expense_claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_payouts_v_rels" ADD CONSTRAINT "_payouts_v_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_receipt_id_documents_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "proposals_rels" ADD CONSTRAINT "proposals_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "proposals_rels" ADD CONSTRAINT "proposals_rels_pricing_plans_fk" FOREIGN KEY ("pricing_plans_id") REFERENCES "public"."pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ops_settings_exchange_rates" ADD CONSTRAINT "ops_settings_exchange_rates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ops_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ops_settings_v_version_exchange_rates" ADD CONSTRAINT "_ops_settings_v_version_exchange_rates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_ops_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "client_payments_costs_order_idx" ON "client_payments_costs" USING btree ("_order");
  CREATE INDEX "client_payments_costs_parent_id_idx" ON "client_payments_costs" USING btree ("_parent_id");
  CREATE INDEX "client_payments_costs_receipt_idx" ON "client_payments_costs" USING btree ("receipt_id");
  CREATE INDEX "client_payments_invoice_idx" ON "client_payments" USING btree ("invoice_id");
  CREATE INDEX "client_payments_deal_idx" ON "client_payments" USING btree ("deal_id");
  CREATE INDEX "client_payments_client_idx" ON "client_payments" USING btree ("client_id");
  CREATE INDEX "client_payments_cleared_at_idx" ON "client_payments" USING btree ("cleared_at");
  CREATE INDEX "client_payments_reference_idx" ON "client_payments" USING btree ("reference");
  CREATE INDEX "client_payments_refund_of_idx" ON "client_payments" USING btree ("refund_of_id");
  CREATE INDEX "client_payments_commission_g_h_s_minor_idx" ON "client_payments" USING btree ("commission_g_h_s_minor");
  CREATE INDEX "client_payments_commission_due_at_idx" ON "client_payments" USING btree ("commission_due_at");
  CREATE INDEX "client_payments_credit_to_idx" ON "client_payments" USING btree ("credit_to_id");
  CREATE INDEX "client_payments_payout_idx" ON "client_payments" USING btree ("payout_id");
  CREATE INDEX "client_payments_terms_used_idx" ON "client_payments" USING btree ("terms_used_id");
  CREATE INDEX "client_payments_updated_at_idx" ON "client_payments" USING btree ("updated_at");
  CREATE INDEX "client_payments_created_at_idx" ON "client_payments" USING btree ("created_at");
  CREATE INDEX "_client_payments_v_version_costs_order_idx" ON "_client_payments_v_version_costs" USING btree ("_order");
  CREATE INDEX "_client_payments_v_version_costs_parent_id_idx" ON "_client_payments_v_version_costs" USING btree ("_parent_id");
  CREATE INDEX "_client_payments_v_version_costs_receipt_idx" ON "_client_payments_v_version_costs" USING btree ("receipt_id");
  CREATE INDEX "_client_payments_v_parent_idx" ON "_client_payments_v" USING btree ("parent_id");
  CREATE INDEX "_client_payments_v_version_version_invoice_idx" ON "_client_payments_v" USING btree ("version_invoice_id");
  CREATE INDEX "_client_payments_v_version_version_deal_idx" ON "_client_payments_v" USING btree ("version_deal_id");
  CREATE INDEX "_client_payments_v_version_version_client_idx" ON "_client_payments_v" USING btree ("version_client_id");
  CREATE INDEX "_client_payments_v_version_version_cleared_at_idx" ON "_client_payments_v" USING btree ("version_cleared_at");
  CREATE INDEX "_client_payments_v_version_version_reference_idx" ON "_client_payments_v" USING btree ("version_reference");
  CREATE INDEX "_client_payments_v_version_version_refund_of_idx" ON "_client_payments_v" USING btree ("version_refund_of_id");
  CREATE INDEX "_client_payments_v_version_version_commission_g_h_s_mino_idx" ON "_client_payments_v" USING btree ("version_commission_g_h_s_minor");
  CREATE INDEX "_client_payments_v_version_version_commission_due_at_idx" ON "_client_payments_v" USING btree ("version_commission_due_at");
  CREATE INDEX "_client_payments_v_version_version_credit_to_idx" ON "_client_payments_v" USING btree ("version_credit_to_id");
  CREATE INDEX "_client_payments_v_version_version_payout_idx" ON "_client_payments_v" USING btree ("version_payout_id");
  CREATE INDEX "_client_payments_v_version_version_terms_used_idx" ON "_client_payments_v" USING btree ("version_terms_used_id");
  CREATE INDEX "_client_payments_v_version_version_updated_at_idx" ON "_client_payments_v" USING btree ("version_updated_at");
  CREATE INDEX "_client_payments_v_version_version_created_at_idx" ON "_client_payments_v" USING btree ("version_created_at");
  CREATE INDEX "_client_payments_v_created_at_idx" ON "_client_payments_v" USING btree ("created_at");
  CREATE INDEX "_client_payments_v_updated_at_idx" ON "_client_payments_v" USING btree ("updated_at");
  CREATE INDEX "payouts_user_idx" ON "payouts" USING btree ("user_id");
  CREATE INDEX "payouts_type_idx" ON "payouts" USING btree ("type");
  CREATE INDEX "payouts_paid_at_idx" ON "payouts" USING btree ("paid_at");
  CREATE INDEX "payouts_terms_used_idx" ON "payouts" USING btree ("terms_used_id");
  CREATE INDEX "payouts_updated_at_idx" ON "payouts" USING btree ("updated_at");
  CREATE INDEX "payouts_created_at_idx" ON "payouts" USING btree ("created_at");
  CREATE INDEX "payouts_rels_order_idx" ON "payouts_rels" USING btree ("order");
  CREATE INDEX "payouts_rels_parent_idx" ON "payouts_rels" USING btree ("parent_id");
  CREATE INDEX "payouts_rels_path_idx" ON "payouts_rels" USING btree ("path");
  CREATE INDEX "payouts_rels_client_payments_id_idx" ON "payouts_rels" USING btree ("client_payments_id");
  CREATE INDEX "payouts_rels_expense_claims_id_idx" ON "payouts_rels" USING btree ("expense_claims_id");
  CREATE INDEX "payouts_rels_documents_id_idx" ON "payouts_rels" USING btree ("documents_id");
  CREATE INDEX "_payouts_v_parent_idx" ON "_payouts_v" USING btree ("parent_id");
  CREATE INDEX "_payouts_v_version_version_user_idx" ON "_payouts_v" USING btree ("version_user_id");
  CREATE INDEX "_payouts_v_version_version_type_idx" ON "_payouts_v" USING btree ("version_type");
  CREATE INDEX "_payouts_v_version_version_paid_at_idx" ON "_payouts_v" USING btree ("version_paid_at");
  CREATE INDEX "_payouts_v_version_version_terms_used_idx" ON "_payouts_v" USING btree ("version_terms_used_id");
  CREATE INDEX "_payouts_v_version_version_updated_at_idx" ON "_payouts_v" USING btree ("version_updated_at");
  CREATE INDEX "_payouts_v_version_version_created_at_idx" ON "_payouts_v" USING btree ("version_created_at");
  CREATE INDEX "_payouts_v_created_at_idx" ON "_payouts_v" USING btree ("created_at");
  CREATE INDEX "_payouts_v_updated_at_idx" ON "_payouts_v" USING btree ("updated_at");
  CREATE INDEX "_payouts_v_rels_order_idx" ON "_payouts_v_rels" USING btree ("order");
  CREATE INDEX "_payouts_v_rels_parent_idx" ON "_payouts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_payouts_v_rels_path_idx" ON "_payouts_v_rels" USING btree ("path");
  CREATE INDEX "_payouts_v_rels_client_payments_id_idx" ON "_payouts_v_rels" USING btree ("client_payments_id");
  CREATE INDEX "_payouts_v_rels_expense_claims_id_idx" ON "_payouts_v_rels" USING btree ("expense_claims_id");
  CREATE INDEX "_payouts_v_rels_documents_id_idx" ON "_payouts_v_rels" USING btree ("documents_id");
  CREATE INDEX "expense_claims_user_idx" ON "expense_claims" USING btree ("user_id");
  CREATE INDEX "expense_claims_receipt_idx" ON "expense_claims" USING btree ("receipt_id");
  CREATE INDEX "expense_claims_status_idx" ON "expense_claims" USING btree ("status");
  CREATE INDEX "expense_claims_decided_by_idx" ON "expense_claims" USING btree ("decided_by_id");
  CREATE INDEX "expense_claims_payout_idx" ON "expense_claims" USING btree ("payout_id");
  CREATE INDEX "expense_claims_updated_at_idx" ON "expense_claims" USING btree ("updated_at");
  CREATE INDEX "expense_claims_created_at_idx" ON "expense_claims" USING btree ("created_at");
  CREATE INDEX "proposals_rels_order_idx" ON "proposals_rels" USING btree ("order");
  CREATE INDEX "proposals_rels_parent_idx" ON "proposals_rels" USING btree ("parent_id");
  CREATE INDEX "proposals_rels_path_idx" ON "proposals_rels" USING btree ("path");
  CREATE INDEX "proposals_rels_pricing_plans_id_idx" ON "proposals_rels" USING btree ("pricing_plans_id");
  CREATE INDEX "ops_settings_exchange_rates_order_idx" ON "ops_settings_exchange_rates" USING btree ("_order");
  CREATE INDEX "ops_settings_exchange_rates_parent_id_idx" ON "ops_settings_exchange_rates" USING btree ("_parent_id");
  CREATE INDEX "_ops_settings_v_version_exchange_rates_order_idx" ON "_ops_settings_v_version_exchange_rates" USING btree ("_order");
  CREATE INDEX "_ops_settings_v_version_exchange_rates_parent_id_idx" ON "_ops_settings_v_version_exchange_rates" USING btree ("_parent_id");
  CREATE INDEX "_ops_settings_v_created_at_idx" ON "_ops_settings_v" USING btree ("created_at");
  CREATE INDEX "_ops_settings_v_updated_at_idx" ON "_ops_settings_v" USING btree ("updated_at");
  ALTER TABLE "clients" ADD CONSTRAINT "clients_source_lead_id_leads_id_fk" FOREIGN KEY ("source_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clients" ADD CONSTRAINT "clients_credit_to_id_users_id_fk" FOREIGN KEY ("credit_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_clients_v" ADD CONSTRAINT "_clients_v_version_source_lead_id_leads_id_fk" FOREIGN KEY ("version_source_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_clients_v" ADD CONSTRAINT "_clients_v_version_credit_to_id_users_id_fk" FOREIGN KEY ("version_credit_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "proposals" ADD CONSTRAINT "proposals_credit_to_id_users_id_fk" FOREIGN KEY ("credit_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deal_id_proposals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_invoices_v" ADD CONSTRAINT "_invoices_v_version_deal_id_proposals_id_fk" FOREIGN KEY ("version_deal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_client_payments_fk" FOREIGN KEY ("client_payments_id") REFERENCES "public"."client_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payouts_fk" FOREIGN KEY ("payouts_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expense_claims_fk" FOREIGN KEY ("expense_claims_id") REFERENCES "public"."expense_claims"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "clients_source_lead_idx" ON "clients" USING btree ("source_lead_id");
  CREATE INDEX "clients_credit_to_idx" ON "clients" USING btree ("credit_to_id");
  CREATE INDEX "_clients_v_version_version_source_lead_idx" ON "_clients_v" USING btree ("version_source_lead_id");
  CREATE INDEX "_clients_v_version_version_credit_to_idx" ON "_clients_v" USING btree ("version_credit_to_id");
  CREATE INDEX "proposals_lead_idx" ON "proposals" USING btree ("lead_id");
  CREATE INDEX "proposals_deal_status_idx" ON "proposals" USING btree ("deal_status");
  CREATE INDEX "proposals_accepted_at_idx" ON "proposals" USING btree ("accepted_at");
  CREATE INDEX "proposals_credit_to_idx" ON "proposals" USING btree ("credit_to_id");
  CREATE INDEX "invoices_deal_idx" ON "invoices" USING btree ("deal_id");
  CREATE INDEX "_invoices_v_version_version_deal_idx" ON "_invoices_v" USING btree ("version_deal_id");
  CREATE INDEX "payload_locked_documents_rels_client_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("client_payments_id");
  CREATE INDEX "payload_locked_documents_rels_payouts_id_idx" ON "payload_locked_documents_rels" USING btree ("payouts_id");
  CREATE INDEX "payload_locked_documents_rels_expense_claims_id_idx" ON "payload_locked_documents_rels" USING btree ("expense_claims_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "client_payments_costs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "client_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_client_payments_v_version_costs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_client_payments_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payouts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payouts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_payouts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_payouts_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "expense_claims" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "proposals_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ops_settings_exchange_rates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ops_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ops_settings_v_version_exchange_rates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ops_settings_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "client_payments_costs" CASCADE;
  DROP TABLE "client_payments" CASCADE;
  DROP TABLE "_client_payments_v_version_costs" CASCADE;
  DROP TABLE "_client_payments_v" CASCADE;
  DROP TABLE "payouts" CASCADE;
  DROP TABLE "payouts_rels" CASCADE;
  DROP TABLE "_payouts_v" CASCADE;
  DROP TABLE "_payouts_v_rels" CASCADE;
  DROP TABLE "expense_claims" CASCADE;
  DROP TABLE "proposals_rels" CASCADE;
  DROP TABLE "ops_settings_exchange_rates" CASCADE;
  DROP TABLE "ops_settings" CASCADE;
  DROP TABLE "_ops_settings_v_version_exchange_rates" CASCADE;
  DROP TABLE "_ops_settings_v" CASCADE;
  ALTER TABLE "clients" DROP CONSTRAINT "clients_source_lead_id_leads_id_fk";
  
  ALTER TABLE "clients" DROP CONSTRAINT "clients_credit_to_id_users_id_fk";
  
  ALTER TABLE "_clients_v" DROP CONSTRAINT "_clients_v_version_source_lead_id_leads_id_fk";
  
  ALTER TABLE "_clients_v" DROP CONSTRAINT "_clients_v_version_credit_to_id_users_id_fk";
  
  ALTER TABLE "proposals" DROP CONSTRAINT "proposals_lead_id_leads_id_fk";
  
  ALTER TABLE "proposals" DROP CONSTRAINT "proposals_credit_to_id_users_id_fk";
  
  ALTER TABLE "invoices" DROP CONSTRAINT "invoices_deal_id_proposals_id_fk";
  
  ALTER TABLE "_invoices_v" DROP CONSTRAINT "_invoices_v_version_deal_id_proposals_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_client_payments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payouts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_expense_claims_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'clientOnboarding', 'teamReminders', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'clientOnboarding', 'teamReminders', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "clients_source_lead_idx";
  DROP INDEX "clients_credit_to_idx";
  DROP INDEX "_clients_v_version_version_source_lead_idx";
  DROP INDEX "_clients_v_version_version_credit_to_idx";
  DROP INDEX "proposals_lead_idx";
  DROP INDEX "proposals_deal_status_idx";
  DROP INDEX "proposals_accepted_at_idx";
  DROP INDEX "proposals_credit_to_idx";
  DROP INDEX "invoices_deal_idx";
  DROP INDEX "_invoices_v_version_version_deal_idx";
  DROP INDEX "payload_locked_documents_rels_client_payments_id_idx";
  DROP INDEX "payload_locked_documents_rels_payouts_id_idx";
  DROP INDEX "payload_locked_documents_rels_expense_claims_id_idx";
  ALTER TABLE "clients" DROP COLUMN "source_lead_id";
  ALTER TABLE "clients" DROP COLUMN "credit_to_id";
  ALTER TABLE "clients" DROP COLUMN "credit_type";
  ALTER TABLE "_clients_v" DROP COLUMN "version_source_lead_id";
  ALTER TABLE "_clients_v" DROP COLUMN "version_credit_to_id";
  ALTER TABLE "_clients_v" DROP COLUMN "version_credit_type";
  ALTER TABLE "proposals" DROP COLUMN "lead_id";
  ALTER TABLE "proposals" DROP COLUMN "deal_status";
  ALTER TABLE "proposals" DROP COLUMN "accepted_at";
  ALTER TABLE "proposals" DROP COLUMN "credit_to_id";
  ALTER TABLE "proposals" DROP COLUMN "credit_type";
  ALTER TABLE "proposals" DROP COLUMN "credit_change_reason";
  ALTER TABLE "proposals" DROP COLUMN "pricing";
  ALTER TABLE "proposals" DROP COLUMN "started_after_salary";
  ALTER TABLE "proposals" DROP COLUMN "ended_at";
  ALTER TABLE "invoices" DROP COLUMN "deal_id";
  ALTER TABLE "_invoices_v" DROP COLUMN "version_deal_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "client_payments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payouts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "expense_claims_id";
  DROP TYPE "public"."enum_client_payments_costs_category";
  DROP TYPE "public"."enum_client_payments_method";
  DROP TYPE "public"."enum_client_payments_currency";
  DROP TYPE "public"."enum_client_payments_credit_type";
  DROP TYPE "public"."enum__client_payments_v_version_costs_category";
  DROP TYPE "public"."enum__client_payments_v_version_method";
  DROP TYPE "public"."enum__client_payments_v_version_currency";
  DROP TYPE "public"."enum__client_payments_v_version_credit_type";
  DROP TYPE "public"."enum_payouts_type";
  DROP TYPE "public"."enum_payouts_currency";
  DROP TYPE "public"."enum_payouts_method";
  DROP TYPE "public"."enum__payouts_v_version_type";
  DROP TYPE "public"."enum__payouts_v_version_currency";
  DROP TYPE "public"."enum__payouts_v_version_method";
  DROP TYPE "public"."enum_expense_claims_currency";
  DROP TYPE "public"."enum_expense_claims_status";
  DROP TYPE "public"."enum_clients_credit_type";
  DROP TYPE "public"."enum__clients_v_version_credit_type";
  DROP TYPE "public"."enum_proposals_deal_status";
  DROP TYPE "public"."enum_proposals_credit_type";
  DROP TYPE "public"."enum_proposals_pricing";
  DROP TYPE "public"."enum_ops_settings_exchange_rates_currency";
  DROP TYPE "public"."enum__ops_settings_v_version_exchange_rates_currency";`)
}
