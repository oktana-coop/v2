import {
  type AutomergeUrl,
  type DocHandle,
  isValidAutomergeUrl,
  type Repo,
} from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import {
  SharedDocumentUnavailableError,
  UnsupportedShareFormatError,
  ValidationError,
} from '../../errors';
import { type RichTextDocument } from '../../models';
import {
  type AutomergeLiveDocument,
  type AutomergeLiveDocumentDeps,
  createLiveDocument,
} from './live-document';
import {
  SHARE_FORMAT_VERSION,
  type SharedContent,
  sharedContentSchema,
} from './shared-content';

export type OpenSharedDocumentError =
  | SharedDocumentUnavailableError
  | UnsupportedShareFormatError
  | ValidationError;

export type AutomergeLiveDocumentAdapterDeps = Omit<
  AutomergeLiveDocumentDeps,
  'handle' | 'initialDiskText'
> & {
  repo: Repo;
  // What the store read at open: the disk's content, and — without a
  // shareUrl — the seed of the document this adapter starts.
  initial: RichTextDocument;
  // The document's address, for a document that has one. Without it the
  // adapter starts the document itself.
  shareUrl?: string;
};

const FIND_TIMEOUT_MS = 10_000;

const parseShareUrl = (
  shareUrl: string
): Effect.Effect<AutomergeUrl, ValidationError> =>
  isValidAutomergeUrl(shareUrl)
    ? Effect.succeed(shareUrl)
    : Effect.fail(new ValidationError('Not a shared document link.'));

const findSharedDocument = ({ repo, url }: { repo: Repo; url: AutomergeUrl }) =>
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

// The document arrives over the network, so nothing about its shape can be
// assumed. A version this adapter does not implement is refused rather than
// edited with the wrong discipline.
const validateSharedDocument = (
  handle: DocHandle<SharedContent>
): Effect.Effect<void, UnsupportedShareFormatError | ValidationError> =>
  Effect.suspend(
    (): Effect.Effect<void, UnsupportedShareFormatError | ValidationError> => {
      const doc: unknown = handle.doc();

      if (sharedContentSchema.safeParse(doc).success) return Effect.void;

      const version = (doc as Partial<SharedContent> | undefined)
        ?.shareFormatVersion;

      return typeof version === 'number' && version !== SHARE_FORMAT_VERSION
        ? Effect.fail(
            new UnsupportedShareFormatError(
              `The shared document uses format version ${version}, this app supports ${SHARE_FORMAT_VERSION}.`
            )
          )
        : Effect.fail(
            new ValidationError('The shared document is not a shared document.')
          );
    }
  );

const acquireHandle = ({
  repo,
  initial,
  shareUrl,
}: Pick<
  AutomergeLiveDocumentAdapterDeps,
  'repo' | 'initial' | 'shareUrl'
>): Effect.Effect<DocHandle<SharedContent>, OpenSharedDocumentError> =>
  shareUrl === undefined
    ? Effect.sync(() =>
        repo.create<SharedContent>({
          shareFormatVersion: SHARE_FORMAT_VERSION,
          content: initial.content,
        })
      )
    : pipe(
        parseShareUrl(shareUrl),
        Effect.flatMap((url) => findSharedDocument({ repo, url })),
        Effect.tap(validateSharedDocument)
      );

type CreateAdapter = {
  (
    deps: AutomergeLiveDocumentAdapterDeps & { shareUrl: string }
  ): Effect.Effect<AutomergeLiveDocument, OpenSharedDocumentError>;
  (
    deps: AutomergeLiveDocumentAdapterDeps & { shareUrl?: undefined }
  ): Effect.Effect<AutomergeLiveDocument>;
};

// The overloads give each caller its true error type: only opening by
// address can fail. The cast reconciles them with the one implementation.
export const createAdapter: CreateAdapter = ((
  deps: AutomergeLiveDocumentAdapterDeps
) =>
  pipe(
    acquireHandle(deps),
    Effect.flatMap((handle) =>
      createLiveDocument({
        handle,
        initialDiskText: deps.initial.content,
        readDocument: deps.readDocument,
        writeDocument: deps.writeDocument,
        subscribeToDocumentChanges: deps.subscribeToDocumentChanges,
        transformToText: deps.transformToText,
        onError: deps.onError,
      })
    )
  )) as CreateAdapter;

export { type AutomergeLiveDocument, type Unsubscribe } from './live-document';
export {
  SHARE_FORMAT_VERSION,
  type SharedContent,
  sharedContentSchema,
} from './shared-content';
