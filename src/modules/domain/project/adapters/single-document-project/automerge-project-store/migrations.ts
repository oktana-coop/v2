import { next as Automerge } from '@automerge/automerge/slim';

import { Migration } from '../../../../../infrastructure/version-control/automerge-lib';
import {
  type SingleDocumentProject,
  type VersionedSingleDocumentProject,
} from '../../../models';

type UnversionedSingleDocumentProject = Omit<
  VersionedSingleDocumentProject,
  'schemaVersion'
>;

export const migrations: Migration[] = [
  {
    version: 0,
    // @ts-expect-error TODO: Fix TS complaining this is not compliant to the generic type
    up: (
      artifact: UnversionedSingleDocumentProject
    ): VersionedSingleDocumentProject =>
      Automerge.change(artifact, (a) => {
        (a as SingleDocumentProject).schemaVersion = 1;
      }) as VersionedSingleDocumentProject,
  },
];
