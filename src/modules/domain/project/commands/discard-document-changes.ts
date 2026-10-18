import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { type StoredLiveDocument } from './live-document';

export type DiscardDocumentChangesDeps = {
  discardUncommittedChanges: ProjectStore['discardUncommittedChanges'];
};

export type DiscardDocumentChangesArgs = {
  projectId: ProjectId;
  openDocument: Pick<
    StoredLiveDocument,
    'documentId' | 'dropPendingLocalEdits' | 'refresh'
  >;
};

export const discardDocumentChanges =
  ({ discardUncommittedChanges }: DiscardDocumentChangesDeps) =>
  ({ projectId, openDocument }: DiscardDocumentChangesArgs) =>
    pipe(
      openDocument.dropPendingLocalEdits,
      Effect.zipRight(
        Effect.suspend(() =>
          discardUncommittedChanges({
            projectId,
            documentId: openDocument.documentId,
          })
        )
      ),
      Effect.zipRight(openDocument.refresh)
    );
