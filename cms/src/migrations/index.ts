import * as migration_20260621_172920_initial_baseline from './20260621_172920_initial_baseline';
import * as migration_20260622_014110_add_users_avatar from './20260622_014110_add_users_avatar';

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
];
