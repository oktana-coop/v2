import {
  type HandleMigration,
  type VersionedArtifactHandle,
} from '../../../../../infrastructure/version-control';
import {
  type MultiDocumentProject,
  type VersionedMultiDocumentProject,
  type VersionedMultiDocumentProjectHandle,
} from '../../../models';

type UnversionedMultiDocumentProject = Omit<
  VersionedMultiDocumentProject,
  'schemaVersion'
>;

export const migrations: HandleMigration[] = [
  {
    version: 0,
    // @ts-expect-error TODO: Fix TS complaining this is not compliant to the generic type
    up: (
      artifactHandle: VersionedArtifactHandle<UnversionedMultiDocumentProject>
    ): VersionedMultiDocumentProjectHandle => {
      artifactHandle.change((a) => {
        (a as MultiDocumentProject).schemaVersion = 1;
      });

      return artifactHandle as VersionedMultiDocumentProjectHandle;
    },
  },
];
