import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type SharedDocumentUnavailableError } from '../errors';
import {
  type DocumentShareKey,
  type DocumentSharing,
  type ShareRegistry,
} from '../ports';
import { type LiveDocument } from './live-document';

export type LeaveSharedDocumentDeps = {
  liveDocument: Pick<LiveDocument, 'detach'>;
  findShareId: ShareRegistry['findShareId'];
  forgetShare: ShareRegistry['forgetShare'];
  leaveSharedDocument: DocumentSharing['leaveSharedDocument'];
};

export const leaveSharedDocument =
  ({
    liveDocument,
    findShareId,
    forgetShare,
    leaveSharedDocument: releaseShare,
  }: LeaveSharedDocumentDeps) =>
  (
    shareKey: DocumentShareKey
  ): Effect.Effect<void, SharedDocumentUnavailableError> =>
    pipe(
      Effect.sync(() => findShareId(shareKey)),
      Effect.flatMap((shareId) =>
        shareId === null
          ? Effect.void
          : pipe(
              Effect.sync(() => forgetShare(shareKey)),
              Effect.zipRight(liveDocument.detach),
              Effect.zipRight(releaseShare({ shareId }))
            )
      )
    );
