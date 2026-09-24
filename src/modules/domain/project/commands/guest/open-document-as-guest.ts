import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type RepresentationTransform } from '../../../../../modules/domain/rich-text';
import {
  type DocumentSharing,
  type OpenSharedDocumentError,
  type ShareId,
} from '../../ports';
import {
  createLiveDocument,
  type CreateLiveDocumentDeps,
  type NamedLiveDocument,
} from '../live-document';

export type OpenDocumentAsGuestDeps = {
  getSharedDocumentInfo: DocumentSharing['getSharedDocumentInfo'];
  openSharedDocument: DocumentSharing['openSharedDocument'];
  createPrivateDocument: CreateLiveDocumentDeps['createPrivateDocument'];
  transformToText: RepresentationTransform['transformToText'];
};

export type OpenDocumentAsGuestArgs = {
  shareId: ShareId;
};

export const openDocumentAsGuest =
  ({
    getSharedDocumentInfo,
    openSharedDocument,
    createPrivateDocument,
    transformToText,
  }: OpenDocumentAsGuestDeps) =>
  ({
    shareId,
  }: OpenDocumentAsGuestArgs): Effect.Effect<
    NamedLiveDocument,
    OpenSharedDocumentError
  > =>
    pipe(
      Effect.all({
        info: getSharedDocumentInfo({ shareId }),
        initialDocument: openSharedDocument({ shareId }),
      }),
      Effect.flatMap(({ info, initialDocument }) =>
        pipe(
          createLiveDocument({
            createPrivateDocument,
            openSharedDocument,
            transformToText,
          })({ documentId: info.documentId, initialDocument }),
          Effect.map((liveDocument): NamedLiveDocument => ({
            ...liveDocument,
            name: info.name,
          }))
        )
      )
    );
