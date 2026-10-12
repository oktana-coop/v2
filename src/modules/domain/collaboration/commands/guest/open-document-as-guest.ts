import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ShareId } from '../../models';
import {
  type DocumentSharing,
  type OpenSharedDocumentError,
} from '../../ports';
import {
  createLiveDocument,
  type CreateLiveDocumentDeps,
  type EditContributor,
  type LiveDocument,
  type NamedLiveDocument,
  withEditing,
} from '../live-document';

export type OpenDocumentAsGuestDeps<
  DocumentType,
  ParticipantSelectionType,
  EditorDocumentType = DocumentType,
> = {
  getSharedDocumentInfo: DocumentSharing<
    DocumentType,
    ParticipantSelectionType
  >['getSharedDocumentInfo'];
  openSharedDocument: DocumentSharing<
    DocumentType,
    ParticipantSelectionType
  >['openSharedDocument'];
  createPrivateDocument: CreateLiveDocumentDeps<
    DocumentType,
    ParticipantSelectionType
  >['createPrivateDocument'];
  editing: (
    document: LiveDocument<DocumentType, ParticipantSelectionType>
  ) => Effect.Effect<EditContributor<EditorDocumentType>>;
};

export type OpenDocumentAsGuestArgs = {
  shareId: ShareId;
};

export const openDocumentAsGuest =
  <DocumentType, ParticipantSelectionType, EditorDocumentType = DocumentType>({
    getSharedDocumentInfo,
    openSharedDocument,
    createPrivateDocument,
    editing,
  }: OpenDocumentAsGuestDeps<
    DocumentType,
    ParticipantSelectionType,
    EditorDocumentType
  >) =>
  ({
    shareId,
  }: OpenDocumentAsGuestArgs): Effect.Effect<
    NamedLiveDocument<
      DocumentType,
      ParticipantSelectionType,
      EditorDocumentType
    >,
    OpenSharedDocumentError
  > =>
    pipe(
      Effect.all({
        info: getSharedDocumentInfo({ shareId }),
        initialDocument: openSharedDocument({ shareId }),
      }),
      Effect.flatMap(({ info, initialDocument }) =>
        pipe(
          createLiveDocument({ createPrivateDocument, openSharedDocument })({
            documentId: info.documentId,
            initialDocument,
          }),
          Effect.flatMap(withEditing(editing)),
          Effect.map(
            (
              liveDocument
            ): NamedLiveDocument<
              DocumentType,
              ParticipantSelectionType,
              EditorDocumentType
            > => ({ ...liveDocument, name: info.name })
          )
        )
      )
    );
