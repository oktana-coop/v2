import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import { type ShareId } from '../../models';
import { type OpenSharedDocumentError } from '../../ports';
import { type ConvergentDocument } from '../../ports';
import { type LiveDocument } from './live-document';
import { createSwitchableDocument } from './switchable-convergent-document';

export type CreateLiveDocumentDeps<DocumentType, ParticipantSelectionType> = {
  // Starts a document nobody else can reach, holding the given document.
  // Nothing about it can fail: there is no link to reach and no format to
  // read.
  createPrivateDocument: (
    doc: DocumentType
  ) => Effect.Effect<
    ConvergentDocument<DocumentType, ParticipantSelectionType>
  >;
  openSharedDocument: (args: {
    shareId: ShareId;
  }) => Effect.Effect<
    ConvergentDocument<DocumentType, ParticipantSelectionType>,
    OpenSharedDocumentError
  >;
};

export type CreateLiveDocumentArgs<DocumentType, ParticipantSelectionType> = {
  documentId: ArtifactId;
  // The convergent document to start with. Sharing, joining and leaving replace it.
  initialDocument: ConvergentDocument<DocumentType, ParticipantSelectionType>;
};

export const createLiveDocument =
  <DocumentType, ParticipantSelectionType>({
    createPrivateDocument,
    openSharedDocument,
  }: CreateLiveDocumentDeps<DocumentType, ParticipantSelectionType>) =>
  ({
    documentId,
    initialDocument,
  }: CreateLiveDocumentArgs<
    DocumentType,
    ParticipantSelectionType
  >): Effect.Effect<LiveDocument<DocumentType, ParticipantSelectionType>> =>
    pipe(
      createSwitchableDocument({ initial: initialDocument }),
      Effect.map((convergentDocument) => {
        const currentDocument = pipe(
          SubscriptionRef.get(convergentDocument.content),
          Effect.map((current) => current.doc)
        );

        const attachTo = (shareId: ShareId) =>
          pipe(
            openSharedDocument({ shareId }),
            Effect.flatMap(convergentDocument.switchTo)
          );

        // The document goes with it: leaving a share keeps what the share
        // left the document holding.
        const detach = pipe(
          currentDocument,
          Effect.flatMap(createPrivateDocument),
          Effect.flatMap(convergentDocument.switchTo)
        );

        return {
          documentId,
          content: convergentDocument.content,
          currentDocument,
          change: convergentDocument.change,
          presence: convergentDocument.presence,
          attachTo,
          detach,
          errors: convergentDocument.errors,
          close: convergentDocument.close,
        };
      })
    );
