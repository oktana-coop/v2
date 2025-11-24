import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { MigrationError, NotFoundError, RepositoryError } from '../../errors';
import {
  type VersionedArtifact,
  type VersionedArtifactHandle,
} from '../../models';
import { getArtifactFromHandle } from '..';

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

export type HandleMigration = {
  version: number;
  up: <
    InputType extends ArtifactWithSchemaVersion,
    ResultType extends ArtifactWithSchemaVersion,
  >(
    artifactHandle: VersionedArtifactHandle<InputType>
  ) => VersionedArtifactHandle<ResultType>;
};

export const getCurrentVersion = (
  artifact: ArtifactWithSchemaVersion
): number => artifact.schemaVersion ?? 0;

export const getCurrentVersionFromHandle = (
  artifactHandle: VersionedArtifactHandle<ArtifactWithSchemaVersion>
): Effect.Effect<number, RepositoryError | NotFoundError, never> =>
  pipe(
    getArtifactFromHandle(artifactHandle),
    Effect.map((artifact) => getCurrentVersion(artifact))
  );

export const needsMigration = ({
  currentVersion,
  targetVersion,
}: {
  currentVersion: number;
  targetVersion: number;
}): boolean => currentVersion < targetVersion;

type MigrateArgs<ArtifactType> = {
  artifactHandle: VersionedArtifactHandle<ArtifactType>;
  currentVersion: number;
  targetVersion: number;
};

export const migrate =
  (migrations: readonly HandleMigration[]) =>
  <ArtifactType extends ArtifactWithSchemaVersion>({
    artifactHandle,
    currentVersion,
    targetVersion,
  }: MigrateArgs<ArtifactType>): Effect.Effect<
    VersionedArtifactHandle<ArtifactType>,
    MigrationError | RepositoryError | NotFoundError,
    never
  > => {
    if (currentVersion >= targetVersion) {
      return Effect.fail(
        new MigrationError(
          `Current version (${currentVersion}) is greater than target version (${targetVersion})`
        )
      );
    }

    const migrationsToApply: HandleMigration[] = [];

    for (let v = currentVersion; v < targetVersion; v++) {
      const migration = migrations.find((m) => m.version === v);
      if (!migration) {
        return Effect.fail(
          new MigrationError(`Missing migration from version ${v} to ${v + 1}`)
        );
      }
      migrationsToApply.push(migration);
    }

    return Effect.try({
      try: () =>
        migrationsToApply.reduce(
          (currentArtifact, migration) => migration.up(currentArtifact),
          artifactHandle
        ),
      catch: mapErrorTo(
        MigrationError,
        'Error in applying migration to the automerge document'
      ),
    });
  };

export const migrateIfNeeded =
  (migrations: readonly HandleMigration[]) =>
  <ArtifactType extends ArtifactWithSchemaVersion>(
    artifactHandle: VersionedArtifactHandle<ArtifactType>,
    targetVersion: number
  ): Effect.Effect<
    VersionedArtifactHandle<ArtifactType>,
    MigrationError | RepositoryError | NotFoundError,
    never
  > =>
    pipe(
      getCurrentVersionFromHandle(artifactHandle),
      Effect.flatMap((currentVersion) =>
        pipe(
          needsMigration({ currentVersion, targetVersion })
            ? migrate(migrations)({
                artifactHandle,
                currentVersion,
                targetVersion,
              })
            : Effect.succeed(artifactHandle)
        )
      )
    );
