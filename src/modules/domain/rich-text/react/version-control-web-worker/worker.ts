import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createAdapter as createAutomergeDocumentStoreAdapter } from '../../../../../modules/domain/rich-text/adapters/automerge-versioned-document-store';
import { setupForWorker as setupBrowserRepoForWorker } from '../../../../../modules/infrastructure/version-control/automerge-repo/browser';
import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import {
  type FailureResult,
  type SuccessResult,
} from '../../../../../utils/web-worker/types';
import {
  RepositoryError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { type VersionedDocumentStore } from '../../ports/versioned-document-store';
import {
  type HistoryInfo,
  isLoadHistoryMessage,
  isSetupMessage,
  isTerminateMessage,
  type VersionControlWebWorkerMessage,
} from './types';

const setupAutomergeRepo = (): Effect.Effect<
  Repo,
  VersionedProjectRepositoryError,
  never
> =>
  Effect.tryPromise({
    try: () => setupBrowserRepoForWorker(),
    catch: mapErrorTo(
      VersionedProjectRepositoryError,
      'Error in setting up Automerge repo'
    ),
  });

let automergeRepo: Repo | null = null;
let documentStore: VersionedDocumentStore | null = null;

self.onmessage = async (event) => {
  const message = event.data as VersionControlWebWorkerMessage;

  try {
    if (isSetupMessage(message)) {
      await Effect.runPromise(
        pipe(
          setupAutomergeRepo(),
          Effect.tap((repo) => {
            automergeRepo = repo;
            documentStore = createAutomergeDocumentStoreAdapter(
              automergeRepo,
              message.data.projectId
            );
          })
        )
      );

      const result: SuccessResult = {
        messageId: message.id,
        success: true,
      };

      self.postMessage(result);
      return;
    } else if (isTerminateMessage(message)) {
      if (automergeRepo) {
        await automergeRepo.shutdown();
        documentStore = null;
        automergeRepo = null;
      }
      self.close();
      return;
    } else if (isLoadHistoryMessage(message)) {
      const historyInfo = await Effect.runPromise(
        pipe(
          fromNullable(
            documentStore,
            () => new RepositoryError('Document store is not initialized')
          ),
          Effect.flatMap((documentStore) =>
            pipe(
              documentStore.findDocumentById(message.data.documentId),
              Effect.flatMap((doc) => documentStore.getDocumentHistory(doc))
            )
          )
        )
      );

      const result: SuccessResult<HistoryInfo> = {
        messageId: message.id,
        success: true,
        data: historyInfo,
      };

      self.postMessage(result);
      return;
    }
  } catch (error) {
    const result: FailureResult = {
      messageId: message.id,
      success: false,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Error in responding to worker message',
    };

    // Send the error back to the main thread
    self.postMessage(result);
  }
};
