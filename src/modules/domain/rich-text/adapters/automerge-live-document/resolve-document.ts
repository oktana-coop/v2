import {
  type AutomergeUrl,
  type DocHandle,
  isValidAutomergeUrl,
  type Repo,
} from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { type SyncServiceError } from '../../../../infrastructure/sync';
import {
  SharedDocumentUnavailableError,
  UnsupportedShareFormatError,
  ValidationError,
} from '../../errors';
import { type LiveDocumentAddress } from '../../ports/live-document';
import {
  genesisFor,
  type SharedContent,
  validateSharedContent,
} from './shared-content';

export type ResolveDocumentError =
  | SharedDocumentUnavailableError
  | UnsupportedShareFormatError
  | ValidationError;

// How long to keep asking peers for a document before giving up on it.
const FIND_TIMEOUT_MS = 10_000;

const parseAddress = (
  address: LiveDocumentAddress
): Effect.Effect<AutomergeUrl, ValidationError> =>
  isValidAutomergeUrl(address)
    ? Effect.succeed(address)
    : Effect.fail(new ValidationError('Not a shared document link.'));

const find = ({ repo, url }: { repo: Repo; url: AutomergeUrl }) =>
  Effect.tryPromise({
    try: () =>
      repo.find<SharedContent>(url, {
        signal: AbortSignal.timeout(FIND_TIMEOUT_MS),
      }),
    catch: mapErrorTo(
      SharedDocumentUnavailableError,
      'The shared document could not be reached.'
    ),
  });

// A document of this app's own, in the repo that never syncs.
export const resolvePrivateDocument = ({
  repo,
  content,
}: {
  repo: Effect.Effect<Repo>;
  content: string;
}): Effect.Effect<DocHandle<SharedContent>> =>
  pipe(
    repo,
    Effect.map((privateRepo) =>
      privateRepo.create<SharedContent>(genesisFor(content))
    )
  );

// The document at an address, in the repo that syncs.
export const resolveSyncedDocument = ({
  repo,
  address,
}: {
  repo: Effect.Effect<Repo, SyncServiceError>;
  address: LiveDocumentAddress;
}): Effect.Effect<DocHandle<SharedContent>, ResolveDocumentError> =>
  pipe(
    Effect.all({
      syncedRepo: pipe(
        repo,
        Effect.mapError(
          () =>
            new SharedDocumentUnavailableError(
              'The sync service could not be started.'
            )
        )
      ),
      url: parseAddress(address),
    }),
    Effect.flatMap(({ syncedRepo, url }) => find({ repo: syncedRepo, url })),
    Effect.tap(validateSharedContent)
  );
