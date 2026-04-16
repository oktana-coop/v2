import * as Effect from 'effect/Effect';

import {
  StoreMigrationError,
  StoreMigrationErrorTag,
} from '../../modules/personalization/errors';
import { CURRENT_SCHEMA_VERSION, migrateStore } from './migrations';
import type { UserPreferencesStore } from './types';

// Only `get` and `set` are used by `migrateStore`, so a plain object
// is sufficient — no need to mock the full electron-store module.
const createMockStore = (
  data: Record<string, unknown> = {}
): UserPreferencesStore =>
  ({
    get: (key: string, defaultValue?: unknown) =>
      key in data ? data[key] : defaultValue,
    set: (key: string, value: unknown) => {
      data[key] = value;
    },
  }) as unknown as UserPreferencesStore;

describe('migrateStore', () => {
  it('sets schemaVersion on a fresh store', () => {
    const store = createMockStore();

    Effect.runSync(migrateStore(store, {}));

    expect(store.get('schemaVersion')).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('runs pending migrations in order', () => {
    const migration1 = vi.fn(() => Effect.void);
    const migration2 = vi.fn(() => Effect.void);
    const store = createMockStore();

    Effect.runSync(migrateStore(store, { 1: migration1, 2: migration2 }));

    expect(migration1).toHaveBeenCalledOnce();
    expect(migration2).toHaveBeenCalledOnce();
    expect(migration1.mock.invocationCallOrder[0]).toBeLessThan(
      migration2.mock.invocationCallOrder[0]
    );
    expect(store.get('schemaVersion')).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('skips already-applied migrations', () => {
    const migration1 = vi.fn(() => Effect.void);
    const migration3 = vi.fn(() => Effect.void);
    const store = createMockStore({ schemaVersion: 2 });

    Effect.runSync(migrateStore(store, { 1: migration1, 3: migration3 }));

    expect(migration1).not.toHaveBeenCalled();
    expect(migration3).toHaveBeenCalledOnce();
  });

  it('surfaces StoreMigrationError on failure', () => {
    const store = createMockStore();

    const error = Effect.runSync(
      migrateStore(store, {
        1: () => Effect.fail(new StoreMigrationError()),
      }).pipe(Effect.flip)
    );

    expect(error._tag).toBe(StoreMigrationErrorTag);
  });
});
