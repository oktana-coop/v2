import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Ref from 'effect/Ref';

import {
  lineEndings,
  type PlainTextConvergentDocument,
  type PlainTextDocument,
  plainTextDocumentsAreEqual,
  plainTextEditing,
  type PlainTextParticipantSelection,
  plainTextToRawPlainText,
  type RawPlainTextFormat,
  rawPlainTextToPlainText,
} from '../../../../modules/domain/plain-text';
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

type PlainTextDocumentSharing = DocumentSharing<
  PlainTextDocument,
  PlainTextParticipantSelection
>;

export type LivePlainTextDocument = StoredLiveDocument<
  PlainTextDocument,
  PlainTextParticipantSelection
>;

export type NamedLivePlainTextDocument = NamedLiveDocument<
  PlainTextDocument,
  PlainTextParticipantSelection
>;

// The store holds the text with the file's own line endings and byte order
// mark: each write restores them as the last read found them.
const plainTextStoredContent = ({
  findPlainTextDocumentById,
  updatePlainTextDocumentContent,
  storedFormat,
}: {
  findPlainTextDocumentById: ProjectStore['findPlainTextDocumentById'];
  updatePlainTextDocumentContent: ProjectStore['updatePlainTextDocumentContent'];
  storedFormat: Ref.Ref<RawPlainTextFormat>;
}): StoredContent<PlainTextDocument> => ({
  read: (args) =>
    pipe(
      findPlainTextDocumentById(args),
      Effect.flatMap((raw) =>
        pipe(
          rawPlainTextToPlainText(raw),
          Effect.mapError((error) => new ValidationError(error.message))
        )
      ),
      Effect.tap(({ format }) => Ref.set(storedFormat, format)),
      Effect.map(({ text }) => ({ content: text }))
    ),
  write: ({ projectId, documentId, document }) =>
    pipe(
      Ref.get(storedFormat),
      Effect.flatMap((format) =>
        updatePlainTextDocumentContent({
          projectId,
          documentId,
          content: plainTextToRawPlainText({ text: document.content, format })
            .content,
        })
      )
    ),
  areEqual: plainTextDocumentsAreEqual,
});

export type OpenLivePlainTextDocumentDeps = {
  createPrivateDocument: (
    doc: PlainTextDocument
  ) => Effect.Effect<PlainTextConvergentDocument>;
  openSharedDocument: PlainTextDocumentSharing['openSharedDocument'];
  findPlainTextDocumentById: ProjectStore['findPlainTextDocumentById'];
  updatePlainTextDocumentContent: ProjectStore['updatePlainTextDocumentContent'];
  projectContentChangeEvents: ProjectStore['projectContentChangeEvents'];
  onShareUnavailable: (error: OpenSharedDocumentError) => void;
};

export const openLivePlainTextDocument =
  ({
    findPlainTextDocumentById,
    updatePlainTextDocumentContent,
    ...deps
  }: OpenLivePlainTextDocumentDeps) =>
  (
    args: OpenLiveDocumentArgs
  ): Effect.Effect<LivePlainTextDocument, StoredContentReadError> =>
    pipe(
      // Each open document keeps its own file's format; the first read sets
      // it before anything is written.
      Ref.make<RawPlainTextFormat>({
        lineEnding: lineEndings.LF,
        byteOrderMark: false,
      }),
      Effect.flatMap((storedFormat) =>
        openLiveDocument({
          ...deps,
          editing: plainTextEditing,
          storedContent: plainTextStoredContent({
            findPlainTextDocumentById,
            updatePlainTextDocumentContent,
            storedFormat,
          }),
        })(args)
      )
    );

export type OpenLivePlainTextDocumentAsGuestDeps = {
  getSharedDocumentInfo: PlainTextDocumentSharing['getSharedDocumentInfo'];
  openSharedDocument: PlainTextDocumentSharing['openSharedDocument'];
  createPrivateDocument: (
    doc: PlainTextDocument
  ) => Effect.Effect<PlainTextConvergentDocument>;
};

export const openLivePlainTextDocumentAsGuest = (
  deps: OpenLivePlainTextDocumentAsGuestDeps
): ((
  args: OpenDocumentAsGuestArgs
) => Effect.Effect<NamedLivePlainTextDocument, OpenSharedDocumentError>) =>
  openDocumentAsGuest({ ...deps, editing: plainTextEditing });
