import * as Automerge from '@automerge/automerge/slim';
import { type DocHandle, type UrlHeads } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { createErrorChannel } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import {
  ConvergentDocumentChangeError,
  ConvergentDocumentUnavailableError,
} from '../../errors';
import {
  type ConvergentDocumentVersion,
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
} from '../../models';
import {
  type ConvergentDocument,
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentError,
  type ConvergentDocumentState,
  type Presence,
} from '../../ports/convergent-document';
import { type DocumentContent } from './document-content';

export type AutomergeConvergentDocumentDeps = {
  handle: DocHandle<DocumentContent>;
  presence: Presence;
};

// Automerge identifies a state by its heads; sorting makes the encoding
// independent of the order they are reported in.
const encodeVersion = (heads: UrlHeads): ConvergentDocumentVersion =>
  [...heads].sort().join(',');

const decodeVersion = (version: ConvergentDocumentVersion): UrlHeads =>
  version.split(',') as UrlHeads;

export const createConvergentDocument = ({
  handle,
  presence,
}: AutomergeConvergentDocumentDeps): Effect.Effect<ConvergentDocument> =>
  pipe(
    Effect.all({
      content: SubscriptionRef.make<ConvergentDocumentState>({
        doc: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content: handle.doc().content,
        },
        version: encodeVersion(handle.heads()),
      }),
      errorChannel: createErrorChannel<ConvergentDocumentError>(),
    }),
    Effect.map(({ content, errorChannel }) => {
      const report = (error: ConvergentDocumentError) => {
        Effect.runSync(PubSub.publish(errorChannel, error));
      };

      const currentVersion = () => encodeVersion(handle.heads());

      const readChange = (): ConvergentDocumentState => ({
        doc: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content: handle.doc().content,
        },
        version: currentVersion(),
      });

      // Applies text as an edit made at `anchor`: a plain change when that
      // is the current state, otherwise anchored so text that arrived
      // meanwhile survives the merge. Returns the version whose content is
      // exactly the applied text.
      const commitText = (
        text: string,
        anchor?: ConvergentDocumentVersion
      ): ConvergentDocumentVersion => {
        if (anchor === undefined || anchor === currentVersion()) {
          handle.change((doc) => Automerge.updateText(doc, ['content'], text));
          return currentVersion();
        }

        try {
          const heads = handle.changeAt(decodeVersion(anchor), (doc) =>
            Automerge.updateText(doc, ['content'], text)
          );
          return heads === undefined ? anchor : encodeVersion(heads);
        } catch (error) {
          // An unknown anchor (e.g. from before a document switch) is
          // dropped rather than applied as a whole-document diff, which
          // would delete text this contribution never saw.
          report(
            mapErrorTo(
              ConvergentDocumentChangeError,
              'A contribution could not be applied.'
            )(error)
          );
          return currentVersion();
        }
      };

      // Contributions can reach here faster than their versions travel back,
      // so several may share a base while each extends the previous one. The
      // last one is what such a contribution actually derives from.
      let lastContribution: {
        base: ConvergentDocumentVersion;
        result: ConvergentDocumentVersion;
      } | null = null;

      const change = (
        content: string,
        options?: ConvergentDocumentChangeOptions
      ) => {
        const base = options?.base;
        const anchor =
          base !== undefined && lastContribution?.base === base
            ? lastContribution.result
            : base;

        const result = commitText(content, anchor);
        if (base !== undefined) lastContribution = { base, result };

        // Published before resolving, so once a contribution resolves,
        // subscribers already hold a state that contains it — what lets the
        // contributor recognize its own echo by version.
        return pipe(publish, Effect.as(result));
      };

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
        Effect.runPromise(publish).catch((error) =>
          report(
            mapErrorTo(
              ConvergentDocumentChangeError,
              'A change could not be published.'
            )(error)
          )
        );
      };

      // The document went away underneath us: stop publishing and keep
      // whatever the editor already shows.
      const handleDocDelete = () => {
        handle.off('change', handleDocChange);
        report(
          new ConvergentDocumentUnavailableError('The document was deleted.')
        );
      };

      const stopListening = () => {
        handle.off('change', handleDocChange);
        handle.off('delete', handleDocDelete);
      };

      handle.on('change', handleDocChange);
      handle.on('delete', handleDocDelete);

      const close = pipe(
        Effect.sync(stopListening),
        Effect.zipRight(presence.close)
      );

      return {
        content,
        change,
        presence: { peers: presence.peers, publish: presence.publish },
        errors: Stream.fromPubSub(errorChannel),
        close,
      };
    })
  );
