import * as migration_20260621_172920_initial_baseline from './20260621_172920_initial_baseline';
import * as migration_20260622_014110_add_users_avatar from './20260622_014110_add_users_avatar';
import * as migration_20260622_020000_add_missing_service_detail_tables from './20260622_020000_add_missing_service_detail_tables';
import * as migration_20260623_000000_add_missing_services_projects_page_tables from './20260623_000000_add_missing_services_projects_page_tables';

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
];
