import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type DocumentShareKey,
  type DocumentSharing,
  type ShareRegistry,
} from '../ports';
import {
  type LiveDocument,
  type LocalEditsContributionError,
} from './live-document';

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
  ): Effect.Effect<void, LocalEditsContributionError> =>
    pipe(
      Effect.sync(() => findShareId(shareKey)),
      Effect.flatMap((shareId) =>
        shareId === null
          ? Effect.void
          : pipe(
              liveDocument.detach,
              Effect.zipRight(Effect.sync(() => forgetShare(shareKey))),
              Effect.zipRight(
                pipe(
                  releaseShare({ shareId }),
                  // A failed release must not refuse a leave that has happened;
                  // the document sharing adapter merely goes on holding the
                  // document.
                  Effect.ignore
                )
              )
            )
      )
    );
