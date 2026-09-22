import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type SharedDocumentUnavailableError } from '../../errors';
import { type DocumentSharing, type ShareId } from '../../ports';
import { type LiveDocument } from '../live-document';

export type LeaveDocumentAsGuestDeps = {
  liveDocument: Pick<LiveDocument, 'close'>;
  forgetShare: () => void;
  leaveSharedDocument: DocumentSharing['leaveSharedDocument'];
};

export const leaveDocumentAsGuest =
  ({
    liveDocument,
    forgetShare,
    leaveSharedDocument: releaseShare,
  }: LeaveDocumentAsGuestDeps) =>
  (shareId: ShareId): Effect.Effect<void, SharedDocumentUnavailableError> =>
    pipe(
      Effect.sync(forgetShare),
      Effect.zipRight(liveDocument.close),
      Effect.zipRight(releaseShare({ shareId }))
    );
