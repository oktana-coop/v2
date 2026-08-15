import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ProjectSync, type ShareUrl } from '../ports';

// Leaves a shared document in place: the live document continues on a fresh
// private document seeded from its current content — no re-open, nothing
// lost. Peers keep the shared document among themselves.
export type LeaveSharedDocumentDeps = {
  forgetShare: () => void;
  // Continues the live document on a fresh private document; composed by
  // the wiring, which knows the concrete adapter.
  detachToPrivate: Effect.Effect<void>;
  leaveSharedDocument: ProjectSync['leaveSharedDocument'];
};

export const leaveSharedDocument =
  ({
    forgetShare,
    detachToPrivate,
    leaveSharedDocument: releaseShare,
  }: LeaveSharedDocumentDeps) =>
  (shareUrl: ShareUrl): Effect.Effect<void> =>
    pipe(
      Effect.sync(forgetShare),
      Effect.zipRight(detachToPrivate),
      Effect.zipRight(releaseShare({ shareUrl }))
    );
