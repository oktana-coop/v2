import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ShareUrl } from '../ports';
import { type LiveDocument } from './live-document';

export type JoinSharedDocumentDeps = {
  liveDocument: Pick<LiveDocument, 'attachTo'>;
  rememberShare: (shareUrl: ShareUrl) => void;
};

export const joinSharedDocument =
  ({ liveDocument, rememberShare }: JoinSharedDocumentDeps) =>
  (shareUrl: ShareUrl): Effect.Effect<void, unknown> =>
    pipe(
      liveDocument.attachTo(shareUrl),
      Effect.tap(() => Effect.sync(() => rememberShare(shareUrl)))
    );
