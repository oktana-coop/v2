import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { flushOpenDocument } from './flush-open-document';
import { type StoredLiveDocument } from './live-document';

export type CommitDocumentDeps = {
  commitDocumentChanges: ProjectStore['commitDocumentChanges'];
};

export type CommitDocumentArgs = {
  projectId: ProjectId;
  openDocument: Pick<StoredLiveDocument, 'documentId' | 'flush'>;
  message: string;
};

export const commitDocument =
  ({ commitDocumentChanges }: CommitDocumentDeps) =>
  ({ projectId, openDocument, message }: CommitDocumentArgs) =>
    pipe(
      flushOpenDocument(openDocument),
      Effect.zipRight(
        Effect.suspend(() =>
          commitDocumentChanges({
            projectId,
            documentId: openDocument.documentId,
            message,
          })
        )
      )
    );
