import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  AI automation and Fieldwork as client services, and a lead reason for each
  (Ernest, 20 October 2026: "do it"). Two of the six services had no value of
  their own: their clients were filed as Custom project and their leads as
  "Something else".

  Services: 'ai-automation' and 'fieldwork' on every list that holds the
  client services (clients, their per-service rows, journeys, guides,
  pitches, quotations, quote requests, and the clients' versions).
  Lead reasons: 'slow-replies' (AI automation) and 'needs-leads' (Fieldwork).

  Adding a value is safe to replay (IF NOT EXISTS). The starter journeys and
  guides that use the new values come in their own migration
  (20261020_130100), because Postgres cannot use a new value in the
  transaction that added it.
*/

const SERVICE_ENUMS = [
  'enum_clients_service',
  'enum__clients_v_version_service',
  'enum_clients_customizations_services_service',
  'enum__clients_v_version_customizations_services_service',
  'enum_journey_templates_service',
  'enum_onboarding_guides_service',
  'enum_pitches_service',
  'enum_proposals_service',
  'enum_quote_requests_services',
]
const REASON_ENUMS = ['enum_leads_qualification', 'enum__leads_v_version_qualification']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of SERVICE_ENUMS) {
    await db.execute(sql.raw(`ALTER TYPE "public"."${t}" ADD VALUE IF NOT EXISTS 'ai-automation';`))
    await db.execute(sql.raw(`ALTER TYPE "public"."${t}" ADD VALUE IF NOT EXISTS 'fieldwork';`))
  }
  for (const t of REASON_ENUMS) {
    await db.execute(sql.raw(`ALTER TYPE "public"."${t}" ADD VALUE IF NOT EXISTS 'slow-replies';`))
    await db.execute(sql.raw(`ALTER TYPE "public"."${t}" ADD VALUE IF NOT EXISTS 'needs-leads';`))
  }
}

/*
  Postgres cannot drop a value from a type, so each type is rebuilt without
  the new ones, as the generated migrations do. A row that uses one would
  stop the rebuild; that is deliberate, since going down would lose it.
*/
const COLUMNS: [string, string, string][] = [
  ['enum_clients_service', 'clients', 'service'],
  ['enum__clients_v_version_service', '_clients_v', 'version_service'],
  ['enum_clients_customizations_services_service', 'clients_customizations_services', 'service'],
  ['enum__clients_v_version_customizations_services_service', '_clients_v_version_customizations_services', 'service'],
  ['enum_journey_templates_service', 'journey_templates', 'service'],
  ['enum_onboarding_guides_service', 'onboarding_guides', 'service'],
  ['enum_pitches_service', 'pitches', 'service'],
  ['enum_proposals_service', 'proposals', 'service'],
  ['enum_quote_requests_services', 'quote_requests_services', 'value'],
  ['enum_leads_qualification', 'leads', 'qualification'],
  ['enum__leads_v_version_qualification', '_leads_v', 'version_qualification'],
]
const NEW = ['ai-automation', 'fieldwork', 'slow-replies', 'needs-leads']
const rowsOf = (res: any) => res?.rows ?? res ?? []

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const [type, table, column] of COLUMNS) {
    const labels = rowsOf(await db.execute(sql.raw(`SELECT e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = '${type}' ORDER BY e.enumsortorder;`))).map((r: any) => String(r.label)).filter((l: string) => !NEW.includes(l))
    const list = labels.map((l: string) => `'${l.replace(/'/g, "''")}'`).join(', ')
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DATA TYPE text;
      DROP TYPE "public"."${type}";
      CREATE TYPE "public"."${type}" AS ENUM(${list});
      ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DATA TYPE "public"."${type}" USING "${column}"::"public"."${type}";`))
  }
}
