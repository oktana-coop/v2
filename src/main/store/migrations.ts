import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import type { StoreMigrationError } from '../../modules/personalization/errors';
import type { UserPreferencesStore } from './types';

export type Migration = (
  store: UserPreferencesStore
) => Effect.Effect<void, StoreMigrationError>;

export const CURRENT_SCHEMA_VERSION = 1;

export const migrations: Record<number, Migration> = {};

const pendingMigrationVersions = ({
  allMigrations,
  storedVersion,
}: {
  allMigrations: Record<number, Migration>;
  storedVersion: number;
}): ReadonlyArray<number> =>
  Object.keys(allMigrations)
    .map(Number)
    .filter((v) => v > storedVersion)
    .sort((a, b) => a - b);

export const migrateStore = (
  store: UserPreferencesStore,
  allMigrations: Record<number, Migration> = migrations
): Effect.Effect<void, StoreMigrationError> =>
  pipe(
    Effect.forEach(
      pendingMigrationVersions({
        allMigrations,
        storedVersion: store.get('schemaVersion', 0),
      }),
      (version) => allMigrations[version](store)
    ),
    Effect.flatMap(() =>
      Effect.sync(() => store.set('schemaVersion', CURRENT_SCHEMA_VERSION))
    )
  );
