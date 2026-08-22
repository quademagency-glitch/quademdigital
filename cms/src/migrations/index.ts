import * as migration_20260621_172920_initial_baseline from './20260621_172920_initial_baseline';
import * as migration_20260622_014110_add_users_avatar from './20260622_014110_add_users_avatar';
import * as migration_20260622_020000_add_missing_service_detail_tables from './20260622_020000_add_missing_service_detail_tables';
import * as migration_20260623_000000_add_missing_services_projects_page_tables from './20260623_000000_add_missing_services_projects_page_tables';
import * as migration_20260625_010000_add_featured_image_and_portfolio_galleries from './20260625_010000_add_featured_image_and_portfolio_galleries';
import * as migration_20260625_020000_add_email_campaigns_client from './20260625_020000_add_email_campaigns_client';
import * as migration_20260625_030000_add_lead_budget_services_client from './20260625_030000_add_lead_budget_services_client';
import * as migration_20260630_180000_add_blog_posts_content_column from './20260630_180000_add_blog_posts_content_column';
import * as migration_20260701_060000_publish_draft_blog_posts from './20260701_060000_publish_draft_blog_posts';
import * as migration_20260701_190000_add_missing_snapshot_columns from './20260701_190000_add_missing_snapshot_columns';
import * as migration_20260701_193000_migrate_blog_body_to_content from './20260701_193000_migrate_blog_body_to_content';
import * as migration_20260722_120000_add_media_sizes_columns from './20260722_120000_add_media_sizes_columns';
import * as migration_20260730_000000_add_brand_studio_page from './20260730_000000_add_brand_studio_page';
import * as migration_20260731_000000_add_onboarding_documents from './20260731_000000_add_onboarding_documents';
import * as migration_20260731_120000_backfill_clients_contact_page_columns from './20260731_120000_backfill_clients_contact_page_columns';
import * as migration_20260811_000000_add_invoice_payment_fields from './20260811_000000_add_invoice_payment_fields';
import * as migration_20260812_000000_invoice_access_token_default from './20260812_000000_invoice_access_token_default';
import * as migration_20260813_000000_add_invoice_deposits_and_reminders from './20260813_000000_add_invoice_deposits_and_reminders';
import * as migration_20260815_000000_add_lead_source_values from './20260815_000000_add_lead_source_values';
import * as migration_20260815_015651_add_case_study_show_under_services from './20260815_015651_add_case_study_show_under_services';
import * as migration_20260821_230000_add_media_video_pipeline_and_avif from './20260821_230000_add_media_video_pipeline_and_avif';
import * as migration_20260822_140000_add_showreel_video_file from './20260822_140000_add_showreel_video_file';
import * as migration_20260822_200000_add_seo_meta_fields from './20260822_200000_add_seo_meta_fields';
import * as migration_20260822_232854_add_crm_versions_and_jobs_queue from './20260822_232854_add_crm_versions_and_jobs_queue';

export const migrations = [
  {
    up: migration_20260621_172920_initial_baseline.up,
    down: migration_20260621_172920_initial_baseline.down,
    name: '20260621_172920_initial_baseline',
  },
  {
    up: migration_20260622_014110_add_users_avatar.up,
    down: migration_20260622_014110_add_users_avatar.down,
    name: '20260622_014110_add_users_avatar',
  },
  {
    up: migration_20260622_020000_add_missing_service_detail_tables.up,
    down: migration_20260622_020000_add_missing_service_detail_tables.down,
    name: '20260622_020000_add_missing_service_detail_tables',
  },
  {
    up: migration_20260623_000000_add_missing_services_projects_page_tables.up,
    down: migration_20260623_000000_add_missing_services_projects_page_tables.down,
    name: '20260623_000000_add_missing_services_projects_page_tables',
  },
  {
    up: migration_20260625_010000_add_featured_image_and_portfolio_galleries.up,
    down: migration_20260625_010000_add_featured_image_and_portfolio_galleries.down,
    name: '20260625_010000_add_featured_image_and_portfolio_galleries',
  },
  {
    up: migration_20260625_020000_add_email_campaigns_client.up,
    down: migration_20260625_020000_add_email_campaigns_client.down,
    name: '20260625_020000_add_email_campaigns_client',
  },
  {
    up: migration_20260625_030000_add_lead_budget_services_client.up,
    down: migration_20260625_030000_add_lead_budget_services_client.down,
    name: '20260625_030000_add_lead_budget_services_client',
  },
  {
    up: migration_20260630_180000_add_blog_posts_content_column.up,
    down: migration_20260630_180000_add_blog_posts_content_column.down,
    name: '20260630_180000_add_blog_posts_content_column',
  },
  {
    up: migration_20260701_060000_publish_draft_blog_posts.up,
    down: migration_20260701_060000_publish_draft_blog_posts.down,
    name: '20260701_060000_publish_draft_blog_posts',
  },
  {
    up: migration_20260701_190000_add_missing_snapshot_columns.up,
    down: migration_20260701_190000_add_missing_snapshot_columns.down,
    name: '20260701_190000_add_missing_snapshot_columns',
  },
  {
    up: migration_20260701_193000_migrate_blog_body_to_content.up,
    down: migration_20260701_193000_migrate_blog_body_to_content.down,
    name: '20260701_193000_migrate_blog_body_to_content',
  },
  {
    up: migration_20260722_120000_add_media_sizes_columns.up,
    down: migration_20260722_120000_add_media_sizes_columns.down,
    name: '20260722_120000_add_media_sizes_columns',
  },
  {
    up: migration_20260730_000000_add_brand_studio_page.up,
    down: migration_20260730_000000_add_brand_studio_page.down,
    name: '20260730_000000_add_brand_studio_page',
  },
  {
    up: migration_20260731_000000_add_onboarding_documents.up,
    down: migration_20260731_000000_add_onboarding_documents.down,
    name: '20260731_000000_add_onboarding_documents',
  },
  {
    up: migration_20260731_120000_backfill_clients_contact_page_columns.up,
    down: migration_20260731_120000_backfill_clients_contact_page_columns.down,
    name: '20260731_120000_backfill_clients_contact_page_columns',
  },
  {
    up: migration_20260811_000000_add_invoice_payment_fields.up,
    down: migration_20260811_000000_add_invoice_payment_fields.down,
    name: '20260811_000000_add_invoice_payment_fields',
  },
  {
    up: migration_20260812_000000_invoice_access_token_default.up,
    down: migration_20260812_000000_invoice_access_token_default.down,
    name: '20260812_000000_invoice_access_token_default',
  },
  {
    up: migration_20260813_000000_add_invoice_deposits_and_reminders.up,
    down: migration_20260813_000000_add_invoice_deposits_and_reminders.down,
    name: '20260813_000000_add_invoice_deposits_and_reminders',
  },
  {
    up: migration_20260815_000000_add_lead_source_values.up,
    down: migration_20260815_000000_add_lead_source_values.down,
    name: '20260815_000000_add_lead_source_values',
  },
  {
    up: migration_20260815_015651_add_case_study_show_under_services.up,
    down: migration_20260815_015651_add_case_study_show_under_services.down,
    name: '20260815_015651_add_case_study_show_under_services',
  },
  {
    up: migration_20260821_230000_add_media_video_pipeline_and_avif.up,
    down: migration_20260821_230000_add_media_video_pipeline_and_avif.down,
    name: '20260821_230000_add_media_video_pipeline_and_avif',
  },
  {
    up: migration_20260822_140000_add_showreel_video_file.up,
    down: migration_20260822_140000_add_showreel_video_file.down,
    name: '20260822_140000_add_showreel_video_file',
  },
  {
    up: migration_20260822_200000_add_seo_meta_fields.up,
    down: migration_20260822_200000_add_seo_meta_fields.down,
    name: '20260822_200000_add_seo_meta_fields',
  },
  {
    up: migration_20260822_232854_add_crm_versions_and_jobs_queue.up,
    down: migration_20260822_232854_add_crm_versions_and_jobs_queue.down,
    name: '20260822_232854_add_crm_versions_and_jobs_queue'
  },
];
