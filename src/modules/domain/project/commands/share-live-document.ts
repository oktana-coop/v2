import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type LiveDocument } from '../../../../modules/domain/rich-text';
import { type ProjectSync, type ShareUrl } from '../ports';

// Shares the open document in place: what it currently holds is minted as
// the shared document, and the document continues on it — no re-open, and
// nothing has to be written to disk first. The disk keeps following the
// live document as always.
export type ShareLiveDocumentDeps = {
  liveDocument: LiveDocument;
  shareDocument: ProjectSync['shareDocument'];
  rememberShare: (shareUrl: ShareUrl) => void;
};

export const shareLiveDocument = ({
  liveDocument,
  shareDocument,
  rememberShare,
}: ShareLiveDocumentDeps): Effect.Effect<ShareUrl, unknown> =>
  pipe(
    SubscriptionRef.get(liveDocument.content),
    Effect.flatMap((current) =>
      shareDocument({ content: current.doc.content })
    ),
    Effect.tap((shareUrl) => liveDocument.attachTo(shareUrl)),
    Effect.tap((shareUrl) => Effect.sync(() => rememberShare(shareUrl)))
  );
