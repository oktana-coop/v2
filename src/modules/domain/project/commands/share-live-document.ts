import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type ProjectId } from '../models';
import {
  type DocumentSharing,
  type SharedDocumentInfo,
  type ShareId,
  type ShareRegistry,
} from '../ports';
import { type LiveDocument } from './live-document';

export type ShareLiveDocumentDeps = {
  liveDocument: Pick<
    LiveDocument,
    'content' | 'attachTo' | 'applyPendingLocalEdits'
  >;
  shareDocument: DocumentSharing['shareDocument'];
  rememberShare: ShareRegistry['rememberShare'];
};

export type ShareLiveDocumentArgs = SharedDocumentInfo & {
  projectId: ProjectId;
};

export const shareLiveDocument =
  ({ liveDocument, shareDocument, rememberShare }: ShareLiveDocumentDeps) =>
  ({
    projectId,
    ...info
  }: ShareLiveDocumentArgs): Effect.Effect<ShareId, unknown> =>
    pipe(
      liveDocument.applyPendingLocalEdits,
      Effect.zipRight(SubscriptionRef.get(liveDocument.content)),
      Effect.flatMap((current) =>
        shareDocument({ content: current.doc.content, ...info })
      ),
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
