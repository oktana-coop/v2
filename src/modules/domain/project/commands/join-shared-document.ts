import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type LiveDocument } from '../../../../modules/domain/rich-text';
import { type ShareUrl } from '../ports';

// Joins the open document to a shared one in place: it continues on the
// document behind the link — no re-open. The shared content wins, and the
// disk follows it as with any change.
export type JoinSharedDocumentDeps = {
  liveDocument: LiveDocument;
  rememberShare: (shareUrl: ShareUrl) => void;
};

export const joinSharedDocument =
  ({ liveDocument, rememberShare }: JoinSharedDocumentDeps) =>
  (shareUrl: ShareUrl): Effect.Effect<void, unknown> =>
    pipe(
      liveDocument.attachTo(shareUrl),
      Effect.tap(() => Effect.sync(() => rememberShare(shareUrl)))
    );
