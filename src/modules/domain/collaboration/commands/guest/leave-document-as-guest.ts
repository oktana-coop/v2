import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type LocalEditsContributionError } from '../../errors';
import { type ShareId } from '../../models';
import { type DocumentSharing } from '../../ports';
import { type EditableLiveDocument } from '../live-document';

export type LeaveDocumentAsGuestDeps = {
  liveDocument: Pick<EditableLiveDocument, 'applyPendingLocalEdits' | 'close'>;
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
