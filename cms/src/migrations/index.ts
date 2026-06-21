import * as migration_._20260621_172920_initial_baseline from './._20260621_172920_initial_baseline';
import * as migration_20260621_172920_initial_baseline from './20260621_172920_initial_baseline';

export const migrations = [
  {
    up: migration_._20260621_172920_initial_baseline.up,
    down: migration_._20260621_172920_initial_baseline.down,
    name: '._20260621_172920_initial_baseline',
  },
  {
    up: migration_20260621_172920_initial_baseline.up,
    down: migration_20260621_172920_initial_baseline.down,
    name: '20260621_172920_initial_baseline'
  },
];
