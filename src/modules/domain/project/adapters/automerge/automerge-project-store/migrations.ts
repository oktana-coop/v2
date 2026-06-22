import {
  type HandleMigration,
  type VersionedArtifactHandle,
} from '../../../../../infrastructure/version-control';
import {
  type Project,
  type VersionedProject,
  type VersionedProjectHandle,
} from '../../../models';

type UnversionedProject = Omit<VersionedProject, 'schemaVersion'>;

export const migrations: HandleMigration[] = [
  {
    version: 0,
    // @ts-expect-error TODO: Fix TS complaining this is not compliant to the generic type
    up: (
      artifactHandle: VersionedArtifactHandle<UnversionedProject>
    ): VersionedProjectHandle => {
      artifactHandle.change((a) => {
        (a as Project).schemaVersion = 1;
      });

      return artifactHandle as VersionedProjectHandle;
    },
  },
];
