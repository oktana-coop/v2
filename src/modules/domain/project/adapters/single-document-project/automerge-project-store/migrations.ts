import {
  type HandleMigration,
  type VersionedArtifactHandle,
} from '../../../../../infrastructure/version-control';
import {
  type SingleDocumentProject,
  type VersionedSingleDocumentProject,
  type VersionedSingleDocumentProjectHandle,
} from '../../../models';

type UnversionedSingleDocumentProject = Omit<
  VersionedSingleDocumentProject,
  'schemaVersion'
>;

export const migrations: HandleMigration[] = [
  {
    version: 0,
    // @ts-expect-error TODO: Fix TS complaining this is not compliant to the generic type
    up: (
      artifactHandle: VersionedArtifactHandle<UnversionedSingleDocumentProject>
    ): VersionedSingleDocumentProjectHandle => {
      artifactHandle.change((a) => {
        (a as SingleDocumentProject).schemaVersion = 1;
      });

      return artifactHandle as VersionedSingleDocumentProjectHandle;
    },
  },
];
