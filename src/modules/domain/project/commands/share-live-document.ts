import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type ProjectSync, type ShareUrl } from '../ports';
import { type LiveDocument } from './live-document';

export type ShareLiveDocumentDeps = {
  liveDocument: Pick<LiveDocument, 'content' | 'attachTo'>;
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
