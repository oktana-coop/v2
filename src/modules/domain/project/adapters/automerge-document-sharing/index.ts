import {
  type AutomergeUrl,
  isValidAutomergeUrl,
  type Repo,
} from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { ValidationError } from '../../../rich-text';
import {
  createConvergentDocument,
  type DocumentContent,
  initialDocumentContent,
  validateDocumentContent,
} from '../../../rich-text/adapters/automerge-convergent-document';
import { SharedDocumentUnavailableError } from '../../errors';
import {
  type DocumentSharing,
  type LeaveSharedDocumentArgs,
  type OpenSharedDocumentArgs,
  type ShareDocumentArgs,
} from '../../ports';

export type AutomergeDocumentSharingDeps = {
  // This is an effect because we want to lazily connect on first share/join.
  syncedRepo: Effect.Effect<Repo, unknown>;
  // A shared document keeps working on what it holds, so a failure to
  // publish a change is reported rather than raised.
  onError: (error: unknown) => void;
};

// How long to keep asking peers for a document before giving up on it.
const FIND_TIMEOUT_MS = 10_000;

const parseShareUrl = (
  shareUrl: string
): Effect.Effect<AutomergeUrl, ValidationError> =>
  isValidAutomergeUrl(shareUrl)
    ? Effect.succeed(shareUrl)
    : Effect.fail(new ValidationError('Not a shared document link.'));

const find = ({ repo, url }: { repo: Repo; url: AutomergeUrl }) =>
  Effect.tryPromise({
    try: () =>
      repo.find<DocumentContent>(url, {
        signal: AbortSignal.timeout(FIND_TIMEOUT_MS),
      }),
    catch: mapErrorTo(
      SharedDocumentUnavailableError,
      'The shared document could not be reached.'
    ),
  });

export const createAdapter = ({
  syncedRepo,
  onError,
}: AutomergeDocumentSharingDeps): DocumentSharing => {
  // Reused effect across document-related operations.
  const connectedRepo = pipe(
    syncedRepo,
    // Map repo unavailability errors to document unavailability ones.
    Effect.mapError(
      () =>
        new SharedDocumentUnavailableError(
          'The sync service could not be reached.'
        )
    )
  );

  const shareDocument = ({ content }: ShareDocumentArgs) =>
    pipe(
      connectedRepo,
      Effect.map((repo) => repo.create(initialDocumentContent(content)).url)
    );

  const openSharedDocument = ({ shareUrl }: OpenSharedDocumentArgs) =>
    pipe(
      Effect.all({ repo: connectedRepo, url: parseShareUrl(shareUrl) }),
      Effect.flatMap(({ repo, url }) => find({ repo, url })),
      Effect.tap(validateDocumentContent),
      Effect.flatMap((handle) => createConvergentDocument({ handle, onError }))
    );

  const leaveSharedDocument = ({ shareUrl }: LeaveSharedDocumentArgs) =>
    pipe(
      connectedRepo,
      Effect.map((repo) => {
        if (isValidAutomergeUrl(shareUrl)) repo.delete(shareUrl);
      })
    );

  return { shareDocument, openSharedDocument, leaveSharedDocument };
};
