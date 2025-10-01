import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { MigrationError } from '../../errors';
import { type VersionedArtifact } from '../../models';

export type ArtifactWithSchemaVersion = {
  schemaVersion?: number;
};

export type Migration = {
  version: number;
  up: <
    InputType extends ArtifactWithSchemaVersion,
    ResultType extends ArtifactWithSchemaVersion,
  >(
    artifact: VersionedArtifact<InputType>
  ) => VersionedArtifact<ResultType>;
};

export const getCurrentVersion = (
  artifact: ArtifactWithSchemaVersion
): number => artifact.schemaVersion ?? 0;

export const needsMigration = (
  artifact: ArtifactWithSchemaVersion,
  targetVersion: number
): boolean => getCurrentVersion(artifact) < targetVersion;

export const migrate =
  (migrations: readonly Migration[]) =>
  <ArtifactType extends ArtifactWithSchemaVersion>(
    artifact: VersionedArtifact<ArtifactType>,
    targetVersion: number
  ): Effect.Effect<VersionedArtifact<ArtifactType>, MigrationError, never> =>
    pipe(
      Effect.sync(() => getCurrentVersion(artifact)),
      Effect.tap((currentVersion) =>
        currentVersion >= targetVersion
          ? Effect.fail(
              new MigrationError(
                `Current version (${currentVersion}) is greater than target version (${targetVersion})`
              )
            )
          : Effect.succeed(undefined)
      ),
      // TODO: Make this more EffectTS-idiomatic
      Effect.flatMap((currentVersion) => {
        const migrationsToApply: Migration[] = [];

        for (let v = currentVersion; v < targetVersion; v++) {
          const migration = migrations.find((m) => m.version === v);
          if (!migration) {
            return Effect.fail(
              new MigrationError(
                `Missing migration from version ${v} to ${v + 1}`
              )
            );
          }
          migrationsToApply.push(migration);
        }

        return Effect.try({
          try: () =>
            migrationsToApply.reduce(
              (currentArtifact, migration) => migration.up(currentArtifact),
              artifact
            ),
          catch: mapErrorTo(
            MigrationError,
            'Error in applying migration to the automerge document'
          ),
        });
      })
    );

export const migrateIfNeeded =
  (migrations: readonly Migration[]) =>
  <ArtifactType extends ArtifactWithSchemaVersion>(
    artifact: VersionedArtifact<ArtifactType>,
    targetVersion: number
  ): Effect.Effect<VersionedArtifact<ArtifactType>, MigrationError, never> =>
    needsMigration(artifact, targetVersion)
      ? migrate(migrations)(artifact, targetVersion)
      : Effect.succeed(artifact);
