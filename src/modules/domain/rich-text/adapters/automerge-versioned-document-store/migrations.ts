import {
  type HandleMigration,
  type VersionedArtifactHandle,
} from '../../../../infrastructure/version-control';
import { richTextRepresentations } from '../../constants';
import {
  type RichTextDocument,
  VersionedDocument,
  type VersionedDocumentHandle,
} from '../../models';

type UnversionedRichTextDocument = Omit<VersionedDocument, 'schemaVersion'>;

export const migrations: HandleMigration[] = [
  {
    version: 0,
    // @ts-expect-error TODO: Fix TS complaining this is not compliant to the generic type
    up: (
      artifactHandle: VersionedArtifactHandle<UnversionedRichTextDocument>
    ): VersionedDocumentHandle => {
      artifactHandle.change((a) => {
        (a as RichTextDocument).schemaVersion = 1;
        (a as RichTextDocument).representation =
          richTextRepresentations.AUTOMERGE;
      });

      return artifactHandle as VersionedDocumentHandle;
    },
  },
];
