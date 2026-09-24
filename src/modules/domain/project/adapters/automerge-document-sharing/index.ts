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
  handleVersion,
  validateDocumentContent,
} from '../../../rich-text/adapters/automerge-convergent-document';
import { SharedDocumentUnavailableError } from '../../errors';
import {
  type DocumentSharing,
  type GetSharedDocumentInfoArgs,
  type LeaveSharedDocumentArgs,
  type OpenedSharedDocument,
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
    try: async () => {
      const query = repo.findWithProgress<DocumentContent>(url);
      const handle = await query.whenReady({
        signal: AbortSignal.timeout(FIND_TIMEOUT_MS),
      });
      const foundInStorage = query.peek().sources.storage === 'ready';

      return {
        handle,
        baseVersion: foundInStorage
          ? // A version this app last held the document at.
            handleVersion(handle)
          : // A version this app has no record of holding the document at.
            null,
      };
    },
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
      Effect.tap(({ handle }) => validateDocumentContent(handle))
    );

  const shareDocument = (args: ShareDocumentArgs) =>
    pipe(
      connectedRepo,
      Effect.map((repo) => repo.create(initialSharedDocumentContent(args)).url)
    );

  const openSharedDocument = ({ shareId }: OpenSharedDocumentArgs) =>
    pipe(
      findValidShare(shareId),
      Effect.flatMap(({ handle, baseVersion }) =>
        pipe(
          createSharedConvergentDocument({ handle }),
          Effect.map((document): OpenedSharedDocument => ({
            document,
            baseVersion,
          }))
        )
      )
    );

  const getSharedDocumentInfo = ({ shareId }: GetSharedDocumentInfoArgs) =>
    pipe(
      findValidShare(shareId),
      Effect.flatMap(({ handle }) => readSharedDocumentInfo(handle))
    );

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
