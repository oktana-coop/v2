import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type DocumentSharing,
  type EditableLiveDocument,
  type SharedDocumentInfo,
  type ShareId,
} from '../../collaboration';
import { type ProjectId } from '../models';
import { type ShareRegistry } from '../ports';

export type ShareLiveDocumentDeps<DocumentType> = {
  liveDocument: Pick<
    EditableLiveDocument<DocumentType>,
    'currentDocument' | 'attachTo' | 'applyPendingLocalEdits'
  >;
  shareDocument: DocumentSharing<DocumentType>['shareDocument'];
  rememberShare: ShareRegistry['rememberShare'];
};

export type ShareLiveDocumentArgs = SharedDocumentInfo & {
  projectId: ProjectId;
};

export const shareLiveDocument =
  <DocumentType>({
    liveDocument,
    shareDocument,
    rememberShare,
  }: ShareLiveDocumentDeps<DocumentType>) =>
  ({
    projectId,
    ...info
  }: ShareLiveDocumentArgs): Effect.Effect<ShareId, unknown> =>
    pipe(
      liveDocument.applyPendingLocalEdits,
      Effect.zipRight(liveDocument.currentDocument),
      Effect.flatMap((doc) => shareDocument({ doc, ...info })),
      Effect.tap((shareId) => liveDocument.attachTo(shareId)),
      Effect.tap((shareId) =>
        Effect.sync(() =>
          rememberShare({
            key: {
              projectId,
              branch: info.branch,
              documentId: info.documentId,
            },
            shareId,
          })
        )
      )
    );
