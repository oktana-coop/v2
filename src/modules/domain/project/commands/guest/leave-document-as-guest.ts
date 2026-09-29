import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type DocumentSharing, type ShareId } from '../../ports';
import {
  type LiveDocument,
  type LocalEditsContributionError,
} from '../live-document';

export type LeaveDocumentAsGuestDeps = {
  liveDocument: Pick<LiveDocument, 'applyPendingLocalEdits' | 'close'>;
  forgetShare: () => void;
  leaveSharedDocument: DocumentSharing['leaveSharedDocument'];
};

export const leaveDocumentAsGuest =
  ({
    liveDocument,
    forgetShare,
    leaveSharedDocument: releaseShare,
  }: LeaveDocumentAsGuestDeps) =>
  (shareId: ShareId): Effect.Effect<void, LocalEditsContributionError> =>
    pipe(
      liveDocument.applyPendingLocalEdits,

      Effect.zipRight(liveDocument.close),
      Effect.zipRight(Effect.sync(forgetShare)),
      Effect.zipRight(
        pipe(
          releaseShare({ shareId }),
          // A failed release must not refuse a leave that has happened;
          // the document sharing adapter merely goes on holding the
          // document.
          Effect.ignore
        )
      )
    );
