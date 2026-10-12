import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  parsePrimaryRichTextDocument,
  type ParticipantSelection,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type PrimaryRichTextDocument,
  type RepresentationTransform,
  type RichTextConvergentDocument,
  type RichTextDocument,
  richTextDocumentsAreEqual,
  richTextEditing,
} from '../../../../modules/domain/rich-text';
import {
  type DocumentSharing,
  type NamedLiveDocument,
  openDocumentAsGuest,
  type OpenDocumentAsGuestArgs,
  type OpenSharedDocumentError,
} from '../../collaboration';
import { ValidationError } from '../errors';
import { type ProjectStore } from '../ports';
import {
  type StoredContent,
  type StoredContentReadError,
  type StoredLiveDocument,
} from './live-document';
import {
  openLiveDocument,
  type OpenLiveDocumentArgs,
} from './open-live-document';

type RichTextDocumentSharing = DocumentSharing<
  PrimaryRichTextDocument,
  ParticipantSelection
>;

export type LiveRichTextDocument = StoredLiveDocument<
  PrimaryRichTextDocument,
  ParticipantSelection,
  RichTextDocument
>;

export type NamedLiveRichTextDocument = NamedLiveDocument<
  PrimaryRichTextDocument,
  ParticipantSelection,
  RichTextDocument
>;

// The store holds the document in the primary representation.
const richTextStoredContent = ({
  findRichTextDocumentById,
  updateRichTextDocumentContent,
}: {
  findRichTextDocumentById: ProjectStore['findRichTextDocumentById'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
}): StoredContent<PrimaryRichTextDocument> => ({
  read: (args) =>
    pipe(
      findRichTextDocumentById(args),
      Effect.flatMap(({ artifact }) =>
        pipe(
          parsePrimaryRichTextDocument(artifact),
          Effect.mapError((error) => new ValidationError(error.message))
        )
      )
    ),
  write: ({ projectId, documentId, document }) =>
    updateRichTextDocumentContent({
      projectId,
      documentId,
      representation: PRIMARY_RICH_TEXT_REPRESENTATION,
      content: document.content,
    }),
  areEqual: richTextDocumentsAreEqual,
});

export type OpenLiveRichTextDocumentDeps = {
  createPrivateDocument: (
    doc: PrimaryRichTextDocument
  ) => Effect.Effect<RichTextConvergentDocument>;
  openSharedDocument: RichTextDocumentSharing['openSharedDocument'];
  transformToText: RepresentationTransform['transformToText'];
  findRichTextDocumentById: ProjectStore['findRichTextDocumentById'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
  projectContentChangeEvents: ProjectStore['projectContentChangeEvents'];
  onShareUnavailable: (error: OpenSharedDocumentError) => void;
};

export const openLiveRichTextDocument = ({
  transformToText,
  findRichTextDocumentById,
  updateRichTextDocumentContent,
  ...deps
}: OpenLiveRichTextDocumentDeps): ((
  args: OpenLiveDocumentArgs
) => Effect.Effect<LiveRichTextDocument, StoredContentReadError>) =>
  openLiveDocument({
    ...deps,
    editing: richTextEditing({ transformToText }),
    storedContent: richTextStoredContent({
      findRichTextDocumentById,
      updateRichTextDocumentContent,
    }),
  });

export type OpenLiveRichTextDocumentAsGuestDeps = {
  getSharedDocumentInfo: RichTextDocumentSharing['getSharedDocumentInfo'];
  openSharedDocument: RichTextDocumentSharing['openSharedDocument'];
  createPrivateDocument: (
    doc: PrimaryRichTextDocument
  ) => Effect.Effect<RichTextConvergentDocument>;
  transformToText: RepresentationTransform['transformToText'];
};

export const openLiveRichTextDocumentAsGuest = ({
  transformToText,
  ...deps
}: OpenLiveRichTextDocumentAsGuestDeps): ((
  args: OpenDocumentAsGuestArgs
) => Effect.Effect<NamedLiveRichTextDocument, OpenSharedDocumentError>) =>
  openDocumentAsGuest({
    ...deps,
    editing: richTextEditing({ transformToText }),
  });
