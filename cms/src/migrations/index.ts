import * as migration_20260621_172920_initial_baseline from './20260621_172920_initial_baseline';
import * as migration_20260622_014110_add_users_avatar from './20260622_014110_add_users_avatar';
import * as migration_20260622_020000_add_missing_service_detail_tables from './20260622_020000_add_missing_service_detail_tables';
import * as migration_20260623_000000_add_missing_services_projects_page_tables from './20260623_000000_add_missing_services_projects_page_tables';
import * as migration_20260625_010000_add_featured_image_and_portfolio_galleries from './20260625_010000_add_featured_image_and_portfolio_galleries';
import * as migration_20260625_020000_add_email_campaigns_client from './20260625_020000_add_email_campaigns_client';
import * as migration_20260625_030000_add_lead_budget_services_client from './20260625_030000_add_lead_budget_services_client';
import * as migration_20260630_180000_add_blog_posts_content_column from './20260630_180000_add_blog_posts_content_column';

export const migrations = [
  {
    up: migration_20260621_172920_initial_baseline.up,
    down: migration_20260621_172920_initial_baseline.down,
    name: '20260621_172920_initial_baseline',
  },
  {
    up: migration_20260622_014110_add_users_avatar.up,
    down: migration_20260622_014110_add_users_avatar.down,
    name: '20260622_014110_add_users_avatar'
  },
  {
    up: migration_20260622_020000_add_missing_service_detail_tables.up,
    down: migration_20260622_020000_add_missing_service_detail_tables.down,
    name: '20260622_020000_add_missing_service_detail_tables'
  },
  {
    up: migration_20260623_000000_add_missing_services_projects_page_tables.up,
    down: migration_20260623_000000_add_missing_services_projects_page_tables.down,
    name: '20260623_000000_add_missing_services_projects_page_tables'
  },
  {
    up: migration_20260625_010000_add_featured_image_and_portfolio_galleries.up,
    down: migration_20260625_010000_add_featured_image_and_portfolio_galleries.down,
    name: '20260625_010000_add_featured_image_and_portfolio_galleries'
  },
  {
    up: migration_20260625_020000_add_email_campaigns_client.up,
    down: migration_20260625_020000_add_email_campaigns_client.down,
    name: '20260625_020000_add_email_campaigns_client'
  },
  {
    up: migration_20260625_030000_add_lead_budget_services_client.up,
    down: migration_20260625_030000_add_lead_budget_services_client.down,
    name: '20260625_030000_add_lead_budget_services_client'
  },
  {
    up: migration_20260630_180000_add_blog_posts_content_column.up,
    down: migration_20260630_180000_add_blog_posts_content_column.down,
    name: '20260630_180000_add_blog_posts_content_column'
  },
];
