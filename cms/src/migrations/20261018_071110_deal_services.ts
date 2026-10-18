import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_clients_customizations_services_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'custom');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_clients_customizations_services_billing" AS ENUM('one-off', 'monthly');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum__clients_v_version_customizations_services_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'custom');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum__clients_v_version_customizations_services_billing" AS ENUM('one-off', 'monthly');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE TABLE IF NOT EXISTS "clients_customizations_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"service" "enum_clients_customizations_services_service" NOT NULL,
  	"fee" numeric,
  	"billing" "enum_clients_customizations_services_billing" DEFAULT 'one-off',
  	"months" numeric,
  	"number_of_pages" numeric,
  	"posts_per_month" numeric,
  	"platforms" varchar,
  	"deliverables" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_clients_v_version_customizations_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"service" "enum__clients_v_version_customizations_services_service" NOT NULL,
  	"fee" numeric,
  	"billing" "enum__clients_v_version_customizations_services_billing" DEFAULT 'one-off',
  	"months" numeric,
  	"number_of_pages" numeric,
  	"posts_per_month" numeric,
  	"platforms" varchar,
  	"deliverables" varchar,
  	"_uuid" varchar
  );
  
  DO $$ BEGIN
    ALTER TABLE "clients_customizations_services" ADD CONSTRAINT "clients_customizations_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "_clients_v_version_customizations_services" ADD CONSTRAINT "_clients_v_version_customizations_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_clients_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "clients_customizations_services_order_idx" ON "clients_customizations_services" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "clients_customizations_services_parent_id_idx" ON "clients_customizations_services" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_clients_v_version_customizations_services_order_idx" ON "_clients_v_version_customizations_services" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_clients_v_version_customizations_services_parent_id_idx" ON "_clients_v_version_customizations_services" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "clients_customizations_services" CASCADE;
  DROP TABLE "_clients_v_version_customizations_services" CASCADE;
  DROP TYPE "public"."enum_clients_customizations_services_service";
  DROP TYPE "public"."enum_clients_customizations_services_billing";
  DROP TYPE "public"."enum__clients_v_version_customizations_services_service";
  DROP TYPE "public"."enum__clients_v_version_customizations_services_billing";`)
}
