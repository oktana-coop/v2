import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import {
  createLiveDocument,
  type CreateLiveDocumentDeps,
  type EditContributor,
  type LiveDocument,
  type OpenSharedDocumentError,
  type ShareId,
  withEditing,
} from '../../collaboration';
import { type ProjectId } from '../models';
import {
  type StoredContentReadError,
  type StoredLiveDocument,
  withStoredCopy,
  type WithStoredCopyDeps,
} from './live-document';

export type OpenLiveDocumentDeps<
  DocumentType,
  ParticipantSelectionType,
  EditorDocumentType = DocumentType,
> = CreateLiveDocumentDeps<DocumentType, ParticipantSelectionType> &
  WithStoredCopyDeps<DocumentType> & {
    editing: (
      document: LiveDocument<DocumentType, ParticipantSelectionType>
    ) => Effect.Effect<EditContributor<EditorDocumentType>>;
    onShareUnavailable: (error: OpenSharedDocumentError) => void;
  };

export type OpenLiveDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
  shareId?: ShareId;
};

export const openLiveDocument =
  <DocumentType, ParticipantSelectionType, EditorDocumentType = DocumentType>(
    deps: OpenLiveDocumentDeps<
      DocumentType,
      ParticipantSelectionType,
      EditorDocumentType
    >
  ) =>
  ({
    projectId,
    documentId,
    shareId,
  }: OpenLiveDocumentArgs): Effect.Effect<
    StoredLiveDocument<
      DocumentType,
      ParticipantSelectionType,
      EditorDocumentType
    >,
    StoredContentReadError
  > => {
    const openInitialDocument = (document: DocumentType) =>
      shareId === undefined
        ? deps.createPrivateDocument(document)
        : pipe(
            deps.openSharedDocument({ shareId }),
            // Fall back to a private document.
            Effect.catchAll((error) =>
              pipe(
                Effect.sync(() => deps.onShareUnavailable(error)),
                Effect.zipRight(deps.createPrivateDocument(document))
              )
            )
          );

    return pipe(
      deps.storedContent.read({ projectId, documentId }),
      Effect.flatMap((initial) =>
        pipe(
          openInitialDocument(initial),
          Effect.flatMap((initialDocument) =>
            createLiveDocument(deps)({ documentId, initialDocument })
          ),
          Effect.flatMap(withEditing(deps.editing)),
          Effect.flatMap(
            withStoredCopy(deps)({ projectId, documentId, initial })
          )
        )
      )
    );
  };
