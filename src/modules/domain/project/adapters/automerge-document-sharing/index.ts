import {
  type AutomergeUrl,
  isValidAutomergeUrl,
  parseAutomergeUrl,
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
  type GetSharedDocumentInfoArgs,
  type LeaveSharedDocumentArgs,
  type OpenSharedDocumentArgs,
  type ShareDocumentArgs,
} from '../../ports';
import {
  initialSharedDocumentContent,
  readSharedDocumentInfo,
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

  const shareDocument = (args: ShareDocumentArgs) =>
    pipe(
      connectedRepo,
      Effect.map((repo) => repo.create(initialSharedDocumentContent(args)).url)
    );

  const openSharedDocument = ({ shareId }: OpenSharedDocumentArgs) =>
    pipe(
      findValidShare(shareId),
      Effect.flatMap((handle) => createSharedConvergentDocument({ handle }))
    );

  const getSharedDocumentInfo = ({ shareId }: GetSharedDocumentInfoArgs) =>
    pipe(findValidShare(shareId), Effect.flatMap(readSharedDocumentInfo));

  const leaveSharedDocument = ({ shareId }: LeaveSharedDocumentArgs) =>
    pipe(
      connectedRepo,
      Effect.flatMap((repo) =>
        isValidAutomergeUrl(shareId)
          ? Effect.tryPromise({
              try: async () => {
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
          : Effect.void
      )
    );

  return {
    shareDocument,
    openSharedDocument,
    getSharedDocumentInfo,
    leaveSharedDocument,
  };
};
