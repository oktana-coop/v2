import { next as Automerge } from '@automerge/automerge/slim';

import { Migration } from '../../../../../infrastructure/version-control/automerge-lib';
import {
  type MultiDocumentProject,
  type VersionedMultiDocumentProject,
} from '../../../models';

type UnversionedMultiDocumentProject = Omit<
  VersionedMultiDocumentProject,
  'schemaVersion'
>;

export const migrations: Migration[] = [
  {
    version: 0,
    up: (
      artifact: UnversionedMultiDocumentProject
    ): VersionedMultiDocumentProject =>
      Automerge.change(artifact, (a) => {
        (a as MultiDocumentProject).schemaVersion = 1;
      }) as VersionedMultiDocumentProject,
  },
];
