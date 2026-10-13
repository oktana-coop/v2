import {
  type AutomergeUrl,
  type DocHandle,
  isValidAutomergeUrl,
  parseAutomergeUrl,
  type Repo,
} from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { SharedDocumentUnavailableError, ValidationError } from '../../errors';
import { type ShareId } from '../../models';

// How long to keep asking peers for a document before giving up on it.
const FIND_TIMEOUT_MS = 10_000;

const parseShareId = (
  shareId: string
): Effect.Effect<AutomergeUrl, ValidationError> =>
  isValidAutomergeUrl(shareId)
    ? Effect.succeed(shareId)
    : Effect.fail(new ValidationError('Not a shared document link.'));

export const connect = (
  syncedRepo: Effect.Effect<Repo, unknown>
): Effect.Effect<Repo, SharedDocumentUnavailableError> =>
  pipe(
    syncedRepo,
    // Map repo unavailability errors to document unavailability ones.
    Effect.mapError(
      () =>
        new SharedDocumentUnavailableError(
          'The sync service could not be reached.'
        )
    )
  );

export const findShare = ({
  repo,
  shareId,
}: {
  repo: Repo;
  shareId: ShareId;
}): Effect.Effect<
  DocHandle<unknown>,
  SharedDocumentUnavailableError | ValidationError
> =>
  pipe(
    parseShareId(shareId),
    Effect.flatMap((url) =>
      Effect.tryPromise({
        try: () =>
          repo.find<unknown>(url, {
            signal: AbortSignal.timeout(FIND_TIMEOUT_MS),
          }),
        catch: mapErrorTo(
          SharedDocumentUnavailableError,
          'The shared document could not be reached.'
        ),
      })
    )
  );

export const createShare = <ContentType>({
  repo,
  content,
}: {
  repo: Repo;
  content: ContentType;
}): ShareId => repo.create(content).url;

export const releaseShare = ({
  repo,
  shareId,
}: {
  repo: Repo;
  shareId: ShareId;
}): Effect.Effect<void, SharedDocumentUnavailableError> =>
  isValidAutomergeUrl(shareId)
    ? Effect.tryPromise({
        try: async () => {
          // TODO: Leaving is local only. The sync server keeps sending
          // this document's updates, and the first one makes the repo
          // recreate the document, synced and stored again. Refuse left
          // documents in the share config, and discuss an upstream way
          // to tell the sync server we left.
          repo.delete(shareId);

          // The repo removes the document from storage on delete
          // without waiting for it to resolve.
          //
          // TODO: Discuss fixing upstream (automerge-repo).
          await repo.storageSubsystem?.removeDoc(
            parseAutomergeUrl(shareId).documentId
          );
        },
        catch: mapErrorTo(
          SharedDocumentUnavailableError,
          'The shared document could not be released.'
        ),
      })
    : Effect.void;
