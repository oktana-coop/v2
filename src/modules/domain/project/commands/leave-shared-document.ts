import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ProjectSync, type ShareUrl } from '../ports';
import { type LiveDocument } from './live-document';

// Leaves a shared document in place: the open document continues on one of
// its own, holding what it holds now — no re-open, nothing lost. Peers keep
// the shared document among themselves.
export type LeaveSharedDocumentDeps = {
  liveDocument: Pick<LiveDocument, 'detach'>;
  forgetShare: () => void;
  leaveSharedDocument: ProjectSync['leaveSharedDocument'];
};

export const leaveSharedDocument =
  ({
    liveDocument,
    forgetShare,
    leaveSharedDocument: releaseShare,
  }: LeaveSharedDocumentDeps) =>
  (shareUrl: ShareUrl): Effect.Effect<void> =>
    pipe(
      Effect.sync(forgetShare),
      Effect.zipRight(liveDocument.detach),
      Effect.zipRight(releaseShare({ shareUrl }))
    );
