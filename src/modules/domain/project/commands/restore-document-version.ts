import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type Commit } from '../../../../modules/infrastructure/version-control';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { flushOpenDocument } from './flush-open-document';
import { type StoredLiveDocument } from './live-document';

export type RestoreDocumentVersionDeps = {
  restoreDocumentChanges: ProjectStore['restoreDocumentChanges'];
};

export type RestoreDocumentVersionArgs = {
  projectId: ProjectId;
  openDocument: Pick<StoredLiveDocument, 'documentId' | 'flush' | 'refresh'>;
  commit: Commit;
  message: string;
};

export const restoreDocumentVersion =
  ({ restoreDocumentChanges }: RestoreDocumentVersionDeps) =>
  ({ projectId, openDocument, commit, message }: RestoreDocumentVersionArgs) =>
    pipe(
      flushOpenDocument(openDocument),
      Effect.zipRight(
        Effect.suspend(() =>
          restoreDocumentChanges({
            projectId,
            documentId: openDocument.documentId,
            commit,
            message,
          })
        )
      ),
      Effect.tap(() => openDocument.refresh)
    );
