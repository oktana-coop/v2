import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ProjectSync, type ShareUrl } from '../ports';

// Shares the open document in place: its live content is minted as the
// shared document, and the live document continues on it — no re-open, no
// flush-first contract. The disk is unaffected; persistence follows the
// live document as always.
export type ShareLiveDocumentDeps = {
  // The live document's current primary-text content.
  readLiveContent: Effect.Effect<string>;
  shareDocument: ProjectSync['shareDocument'];
  // Continues the live document on the shared document at the given
  // address; composed by the wiring, which knows the concrete adapter.
  attachSharedDocument: (shareUrl: ShareUrl) => Effect.Effect<void, unknown>;
  rememberShare: (shareUrl: ShareUrl) => void;
};

export const shareLiveDocument = ({
  readLiveContent,
  shareDocument,
  attachSharedDocument,
  rememberShare,
}: ShareLiveDocumentDeps): Effect.Effect<ShareUrl, unknown> =>
  pipe(
    readLiveContent,
    Effect.flatMap((content) => shareDocument({ content })),
    Effect.tap(attachSharedDocument),
    Effect.tap((shareUrl) => Effect.sync(() => rememberShare(shareUrl)))
  );
