import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type DocumentSharing,
  type SharedDocumentIdentity,
  type ShareUrl,
} from '../ports';
import { type LiveDocument } from './live-document';

export type ShareLiveDocumentDeps = {
  liveDocument: Pick<
    LiveDocument,
    'content' | 'attachTo' | 'applyPendingLocalEdits'
  >;
  shareDocument: DocumentSharing['shareDocument'];
  rememberShare: (shareUrl: ShareUrl) => void;
};

// The share carries how the document is named here, so a peer can find its own
// copy of it rather than having to be told.
export type ShareLiveDocumentArgs = SharedDocumentIdentity;

export const shareLiveDocument =
  ({ liveDocument, shareDocument, rememberShare }: ShareLiveDocumentDeps) =>
  ({
    branch,
    documentId,
  }: ShareLiveDocumentArgs): Effect.Effect<ShareUrl, unknown> =>
    pipe(
      liveDocument.applyPendingLocalEdits,
      Effect.zipRight(SubscriptionRef.get(liveDocument.content)),
      Effect.flatMap((current) =>
        shareDocument({ content: current.doc.content, branch, documentId })
      ),
      Effect.tap((shareUrl) => liveDocument.attachTo(shareUrl)),
      Effect.tap((shareUrl) => Effect.sync(() => rememberShare(shareUrl)))
    );
