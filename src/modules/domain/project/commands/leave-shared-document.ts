import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type SharedDocumentUnavailableError } from '../errors';
import { type DocumentSharing, type ShareId } from '../ports';
import { type LiveDocument } from './live-document';

export type LeaveSharedDocumentDeps = {
  liveDocument: Pick<LiveDocument, 'detach'>;
  forgetShare: () => void;
  leaveSharedDocument: DocumentSharing['leaveSharedDocument'];
};

export const leaveSharedDocument =
  ({
    liveDocument,
    forgetShare,
    leaveSharedDocument: releaseShare,
  }: LeaveSharedDocumentDeps) =>
  (shareId: ShareId): Effect.Effect<void, SharedDocumentUnavailableError> =>
    pipe(
      Effect.sync(forgetShare),
      Effect.zipRight(liveDocument.detach),
      Effect.zipRight(releaseShare({ shareId }))
    );
