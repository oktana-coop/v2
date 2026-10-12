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
import {
  SharedDocumentUnavailableError,
  type UnsupportedDocumentFormatError,
  ValidationError,
} from '../../errors';
import {
  type ConvergentDocument,
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
// How a kind of document is held in Automerge, and how to work on one.
export type AutomergeBinding<
  DocumentType,
  ParticipantSelectionType,
  AutomergeContentType,
> = {
  // The Automerge content a document of this kind starts as.
  initialContent: (doc: DocumentType) => AutomergeContentType;
  // Reads an Automerge document as this kind's content, in a format this app
  // implements.
  parse: (
    handle: DocHandle<unknown>
  ) => Effect.Effect<
    DocHandle<AutomergeContentType>,
    UnsupportedDocumentFormatError | ValidationError
  >;
  open: (
    handle: DocHandle<AutomergeContentType>
  ) => Effect.Effect<
    ConvergentDocument<DocumentType, ParticipantSelectionType>
  >;
};

export type AutomergeDocumentSharingDeps<
  DocumentType,
  ParticipantSelectionType,
  AutomergeContentType,
> = {
  // This is an effect because we want to lazily connect on first share/join.
  syncedRepo: Effect.Effect<Repo, unknown>;
  binding: AutomergeBinding<
    DocumentType,
    ParticipantSelectionType,
    AutomergeContentType
  >;
};

// How long to keep asking peers for a document before giving up on it.
const FIND_TIMEOUT_MS = 10_000;

const parseShareId = (
  shareId: string
): Effect.Effect<AutomergeUrl, ValidationError> =>
  isValidAutomergeUrl(shareId)
    ? Effect.succeed(shareId)
    : Effect.fail(new ValidationError('Not a shared document link.'));

export const createAdapter = <
  DocumentType,
  ParticipantSelectionType,
  AutomergeContentType,
>({
  syncedRepo,
  binding,
}: AutomergeDocumentSharingDeps<
  DocumentType,
  ParticipantSelectionType,
  AutomergeContentType
>): DocumentSharing<DocumentType, ParticipantSelectionType> => {
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

  const find = ({ repo, url }: { repo: Repo; url: AutomergeUrl }) =>
    Effect.tryPromise({
      try: () =>
        repo.find<unknown>(url, {
          signal: AbortSignal.timeout(FIND_TIMEOUT_MS),
        }),
      catch: mapErrorTo(
        SharedDocumentUnavailableError,
        'The shared document could not be reached.'
      ),
    });

  const findShare = (shareId: string) =>
    pipe(
      Effect.all({ repo: connectedRepo, url: parseShareId(shareId) }),
      Effect.flatMap(({ repo, url }) => find({ repo, url }))
    );

  const shareDocument = ({ doc, ...info }: ShareDocumentArgs<DocumentType>) =>
    pipe(
      connectedRepo,
      Effect.map(
        (repo) =>
          repo.create(
            initialSharedDocumentContent({
              content: binding.initialContent(doc),
              ...info,
            })
          ).url
      )
    );

  const openSharedDocument = ({ shareId }: OpenSharedDocumentArgs) =>
    pipe(
      findShare(shareId),
      Effect.flatMap(binding.parse),
      Effect.flatMap(binding.open)
    );

  const getSharedDocumentInfo = ({ shareId }: GetSharedDocumentInfoArgs) =>
    pipe(
      findShare(shareId),
      Effect.tap(binding.parse),
      Effect.flatMap(readSharedDocumentInfo)
    );

  const leaveSharedDocument = ({ shareId }: LeaveSharedDocumentArgs) =>
    pipe(
      connectedRepo,
      Effect.flatMap((repo) =>
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
