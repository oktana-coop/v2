import * as Automerge from '@automerge/automerge/slim';
import {
  type AutomergeUrl,
  type DocHandle,
  isValidAutomergeUrl,
  type Repo,
  type UrlHeads,
} from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { mapErrorTo } from '../../../../../utils/errors';
import { toPrimaryTextRepresentation } from '../../commands';
import {
  SharedDocumentUnavailableError,
  UnsupportedShareFormatError,
  ValidationError,
} from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
} from '../../models';
import { type RepresentationTransform } from '../../ports';
import {
  type LiveDocument,
  type LiveDocumentChange,
  type LiveDocumentChangeOptions,
  type LiveDocumentVersion,
} from '../../ports/live-document';
import {
  SHARE_FORMAT_VERSION,
  type SharedContent,
  sharedContentSchema,
} from './shared-content';

export type OpenSharedDocumentError =
  | SharedDocumentUnavailableError
  | UnsupportedShareFormatError
  | ValidationError;

export type AutomergeLiveDocumentDeps = {
  repo: Repo;
  shareUrl: string;
  transformToText: RepresentationTransform['transformToText'];
  onError: (error: unknown) => void;
};

const FIND_TIMEOUT_MS = 10_000;

// Automerge identifies a state by its heads; sorting makes the encoding
// independent of the order they are reported in.
const encodeVersion = (heads: UrlHeads): LiveDocumentVersion =>
  [...heads].sort().join(',');

const decodeVersion = (version: LiveDocumentVersion): UrlHeads =>
  version.split(',') as UrlHeads;

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

const createLiveDocument = ({
  handle,
  transformToText,
  onError,
}: {
  handle: DocHandle<SharedContent>;
} & Pick<
  AutomergeLiveDocumentDeps,
  'transformToText' | 'onError'
>): Effect.Effect<LiveDocument> => {
  const currentVersion = () => encodeVersion(handle.heads());

  const readChange = (): LiveDocumentChange => ({
    doc: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      representation: PRIMARY_RICH_TEXT_REPRESENTATION,
      content: handle.doc().content,
    },
    version: currentVersion(),
  });

  const toText = toPrimaryTextRepresentation({ transformToText });

  // A contribution derived from a state other than the current one is applied
  // as if made at that state, so text that arrived meanwhile survives the
  // merge instead of reading as a deletion.
  const applyText = (text: string, base?: LiveDocumentVersion) => {
    const anchored = base !== undefined && base !== currentVersion();

    if (anchored) {
      try {
        handle.changeAt(decodeVersion(base), (doc) =>
          Automerge.updateText(doc, ['content'], text)
        );
        return currentVersion();
      } catch (error) {
        onError(error);
      }
    }

    handle.change((doc) => Automerge.updateText(doc, ['content'], text));
    return currentVersion();
  };

  return pipe(
    SubscriptionRef.make<LiveDocumentChange>(readChange()),
    Effect.map((content) => {
      const publish = pipe(
        SubscriptionRef.get(content),
        Effect.flatMap((current) => {
          const next = readChange();
          // Heads can move without the text moving; subscribers only care
          // about the text.
          return current.doc.content === next.doc.content
            ? Effect.void
            : SubscriptionRef.set(content, next);
        })
      );

      const handleDocChange = () => {
        Effect.runPromise(publish).catch(onError);
      };

      // The document went away underneath us: stop publishing and keep
      // whatever the editor already shows.
      const handleDocDelete = () => {
        handle.off('change', handleDocChange);
        onError(
          new SharedDocumentUnavailableError('The shared document was deleted.')
        );
      };

      handle.on('change', handleDocChange);
      handle.on('delete', handleDocDelete);

      // Only the newest contribution is applied: an older one still being
      // converted is abandoned rather than written over the newer text.
      let latestContribution = 0;

      const change = (
        doc: RichTextDocument,
        options?: LiveDocumentChangeOptions
      ) => {
        const contribution = (latestContribution += 1);

        return pipe(
          toText(doc),
          Effect.map((text) =>
            contribution === latestContribution
              ? applyText(text, options?.base)
              : currentVersion()
          ),
          // Contributing has no error channel: a failed conversion is
          // reported and leaves the document as it was.
          Effect.catchAll((error) =>
            Effect.sync(() => {
              onError(error);
              return currentVersion();
            })
          )
        );
      };

      return {
        content,
        change,
        close: Effect.sync(() => {
          handle.off('change', handleDocChange);
          handle.off('delete', handleDocDelete);
        }),
      };
    })
  );
};

export const createAdapter = ({
  repo,
  shareUrl,
  transformToText,
  onError,
}: AutomergeLiveDocumentDeps): Effect.Effect<
  LiveDocument,
  OpenSharedDocumentError
> =>
  pipe(
    parseShareUrl(shareUrl),
    Effect.flatMap((url) => findSharedDocument({ repo, url })),
    Effect.tap(validateSharedDocument),
    Effect.flatMap((handle) =>
      createLiveDocument({ handle, transformToText, onError })
    )
  );

export {
  SHARE_FORMAT_VERSION,
  type SharedContent,
  sharedContentSchema,
} from './shared-content';
