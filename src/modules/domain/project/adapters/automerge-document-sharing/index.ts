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
  createSharedConvergentDocument,
  type DocumentContent,
  validateDocumentContent,
} from '../../../rich-text/adapters/automerge-convergent-document';
import { SharedDocumentUnavailableError } from '../../errors';
import {
  type DocumentSharing,
  type GetSharedDocumentIdentityArgs,
  type LeaveSharedDocumentArgs,
  type OpenSharedDocumentArgs,
  type ShareDocumentArgs,
} from '../../ports';
import {
  initialSharedDocumentContent,
  readSharedDocumentIdentity,
} from './shared-document';

export type AutomergeDocumentSharingDeps = {
  // This is an effect because we want to lazily connect on first share/join.
  syncedRepo: Effect.Effect<Repo, unknown>;
};

// How long to keep asking peers for a document before giving up on it.
const FIND_TIMEOUT_MS = 10_000;

const parseShareId = (
  shareId: string
): Effect.Effect<AutomergeUrl, ValidationError> =>
  isValidAutomergeUrl(shareId)
    ? Effect.succeed(shareId)
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

  const findValidShare = (shareId: string) =>
    pipe(
      Effect.all({ repo: connectedRepo, url: parseShareId(shareId) }),
      Effect.flatMap(({ repo, url }) => find({ repo, url })),
      Effect.tap(validateDocumentContent)
    );

  const shareDocument = ({ content, branch, documentId }: ShareDocumentArgs) =>
    pipe(
      connectedRepo,
      Effect.map(
        (repo) =>
          repo.create(
            initialSharedDocumentContent({ content, branch, documentId })
          ).url
      )
    );

  const openSharedDocument = ({ shareId }: OpenSharedDocumentArgs) =>
    pipe(
      findValidShare(shareId),
      Effect.flatMap((handle) => createSharedConvergentDocument({ handle }))
    );

  const getSharedDocumentIdentity = ({
    shareId,
  }: GetSharedDocumentIdentityArgs) =>
    pipe(findValidShare(shareId), Effect.flatMap(readSharedDocumentIdentity));

  const leaveSharedDocument = ({ shareId }: LeaveSharedDocumentArgs) =>
    pipe(
      connectedRepo,
      Effect.map((repo) => {
        if (isValidAutomergeUrl(shareId)) repo.delete(shareId);
      })
    );

  return {
    shareDocument,
    openSharedDocument,
    getSharedDocumentIdentity,
    leaveSharedDocument,
  };
};
