import { next as Automerge } from '@automerge/automerge/slim';

import { Migration } from '../../../../infrastructure/version-control/automerge-lib';
import { type RichTextDocument, VersionedDocument } from '../../models';

type UnversionedRichTextDocument = Omit<VersionedDocument, 'schemaVersion'>;

export const migrations: Migration[] = [
  {
    version: 0,
    // @ts-expect-error TODO: Fix TS complaining this is not compliant to the generic type
    up: (artifact: UnversionedRichTextDocument): VersionedDocument =>
      Automerge.change(artifact, (a) => {
        (a as RichTextDocument).schemaVersion = 1;
      }) as VersionedDocument,
  },
];
