import { next as Automerge } from '@automerge/automerge/slim';

import { type VersionedArtifact } from '../../models';

export type ArtifactWithSchemaVersion = {
  schemaVersion?: number;
};

export type Migration = {
  readonly version: number;
  readonly up: (artifact: ArtifactWithSchemaVersion) => void;
};

export const getCurrentVersion = (
  artifact: ArtifactWithSchemaVersion
): number => artifact.schemaVersion ?? 1;

export const needsMigration = (
  artifact: ArtifactWithSchemaVersion,
  targetVersion: number
): boolean => getCurrentVersion(artifact) < targetVersion;

export const migrate = <ArtifactType extends ArtifactWithSchemaVersion>(
  artifact: VersionedArtifact<ArtifactType>,
  migrations: readonly Migration[],
  targetVersion: number
): VersionedArtifact<ArtifactType> => {
  const currentVersion = getCurrentVersion(artifact);

  if (currentVersion > targetVersion) {
    throw new Error(
      `Current version (${currentVersion}) is greater than target version (${targetVersion})`
    );
  }

  const migrationsToApply: Migration[] = [];
  for (let v = currentVersion; v < targetVersion; v++) {
    const migration = migrations.find((m) => m.version === v);
    if (!migration) {
      throw new Error(`Missing migration from version ${v} to ${v + 1}`);
    }
    migrationsToApply.push(migration);
  }

  return migrationsToApply.reduce(
    (currentArtifact, migration) =>
      Automerge.change(currentArtifact, (a) => {
        migration.up(a);
      }),
    artifact
  );
};

export const migrateIfNeeded = <ArtifactType extends ArtifactWithSchemaVersion>(
  artifact: VersionedArtifact<ArtifactType>,
  migrations: readonly Migration[],
  targetVersion: number
): VersionedArtifact<ArtifactType> => {
  if (!needsMigration(artifact, targetVersion)) {
    return artifact;
  }
  return migrate(artifact, migrations, targetVersion);
};
