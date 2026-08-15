import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ShareUrl } from '../ports';

// Joins the open document to a shared document in place: the live document
// continues on the document behind the link — no re-open. The shared
// content wins; persistence writes it to disk as with any change.
export type JoinSharedDocumentDeps = {
  // Continues the live document on the shared document at the given
  // address; composed by the wiring, which knows the concrete adapter.
  attachSharedDocument: (shareUrl: ShareUrl) => Effect.Effect<void, unknown>;
  rememberShare: (shareUrl: ShareUrl) => void;
};

export const joinSharedDocument =
  ({ attachSharedDocument, rememberShare }: JoinSharedDocumentDeps) =>
  (shareUrl: ShareUrl): Effect.Effect<void, unknown> =>
    pipe(
      attachSharedDocument(shareUrl),
      Effect.tap(() => Effect.sync(() => rememberShare(shareUrl)))
    );
