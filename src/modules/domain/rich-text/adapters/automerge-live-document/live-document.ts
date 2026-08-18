import * as Automerge from '@automerge/automerge/slim';
import {
  type DocHandle,
  type Repo,
  type UrlHeads,
} from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type SyncServiceError } from '../../../../infrastructure/sync';
import { toPrimaryTextRepresentation } from '../../commands';
import { SharedDocumentUnavailableError } from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
} from '../../models';
import { type RepresentationTransform } from '../../ports';
import {
  type LiveDocument,
  type LiveDocumentAddress,
  type LiveDocumentChange,
  type LiveDocumentChangeOptions,
  type LiveDocumentVersion,
} from '../../ports/live-document';
import {
  resolvePrivateDocument,
  resolveSyncedDocument,
} from './resolve-document';
import { type SharedContent } from './shared-content';

// The document itself: the canonical CRDT document, contributions made to it,
// and peers reaching it through automerge-repo. Nothing here is serialized —
// merges commute, and every mutation below is synchronous. Whoever contributes
// keeps the ordering they need in the base they report.

export type Unsubscribe = () => void;

export type AutomergeLiveDocumentDeps = {
  handle: DocHandle<SharedContent>;
  // Where documents live: this app's own in the repo that never syncs,
  // shared ones in the repo that does. Effects, so nothing dials the sync
  // service until a document is actually shared or joined.
  privateRepo: Effect.Effect<Repo>;
  syncedRepo: Effect.Effect<Repo, SyncServiceError>;
  transformToText: RepresentationTransform['transformToText'];
  onError: (error: unknown) => void;
};

// Automerge identifies a state by its heads; sorting makes the encoding
// independent of the order they are reported in.
const encodeVersion = (heads: UrlHeads): LiveDocumentVersion =>
  [...heads].sort().join(',');

const decodeVersion = (version: LiveDocumentVersion): UrlHeads =>
  version.split(',') as UrlHeads;

export const createLiveDocument = ({
  handle,
  privateRepo,
  syncedRepo,
  transformToText,
  onError,
}: AutomergeLiveDocumentDeps): Effect.Effect<LiveDocument> =>
  pipe(
    SubscriptionRef.make<LiveDocumentChange>({
      doc: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        representation: PRIMARY_RICH_TEXT_REPRESENTATION,
        content: handle.doc().content,
      },
      version: encodeVersion(handle.heads()),
    }),
    Effect.map((content) => {
      let canonical = handle;

      const currentVersion = () => encodeVersion(canonical.heads());

      const readChange = (): LiveDocumentChange => ({
        doc: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content: canonical.doc().content,
        },
        version: currentVersion(),
      });

      const toText = toPrimaryTextRepresentation({ transformToText });

      // Applies text as an edit made at `anchor`: a plain change when that
      // is the current state, otherwise anchored so text that arrived
      // meanwhile survives the merge. Returns the version whose content is
      // exactly the applied text.
      const commitText = (
        text: string,
        anchor?: LiveDocumentVersion
      ): LiveDocumentVersion => {
        if (anchor === undefined || anchor === currentVersion()) {
          canonical.change((doc) =>
            Automerge.updateText(doc, ['content'], text)
          );
          return currentVersion();
        }

        try {
          const heads = canonical.changeAt(decodeVersion(anchor), (doc) =>
            Automerge.updateText(doc, ['content'], text)
          );
          return heads === undefined ? anchor : encodeVersion(heads);
        } catch (error) {
          // An unknown anchor (e.g. from before a document switch) is
          // dropped rather than applied as a whole-document diff, which
          // would delete text this contribution never saw.
          onError(error);
          return currentVersion();
        }
      };

      // ---- contributions ------------------------------------------------

      // Contributions can outpace their conversions, so several may share a
      // base while each extends the previous one. The last one is what such
      // a contribution actually derives from.
      let lastContribution: {
        base: LiveDocumentVersion;
        result: LiveDocumentVersion;
      } | null = null;

      // Only the newest of a burst is applied; superseded conversions are
      // abandoned rather than written over newer text.
      let latestIntake = 0;

      const change = (
        doc: RichTextDocument,
        options?: LiveDocumentChangeOptions
      ) => {
        const intake = (latestIntake += 1);

        return pipe(
          toText(doc),
          Effect.map((text) => {
            if (intake !== latestIntake) return currentVersion();

            const base = options?.base;
            const anchor =
              base !== undefined && lastContribution?.base === base
                ? lastContribution.result
                : base;

            const result = commitText(text, anchor);
            if (base !== undefined) lastContribution = { base, result };
            return result;
          }),
          // Published before resolving, so once a contribution resolves,
          // subscribers already hold a state that contains it — what lets
          // the contributor recognize its own echo by version.
          Effect.flatMap((result) => pipe(publish, Effect.as(result))),
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

      // ---- the canonical document ---------------------------------------

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
        canonical.off('change', handleDocChange);
        onError(
          new SharedDocumentUnavailableError('The shared document was deleted.')
        );
      };

      const listenTo = (target: DocHandle<SharedContent>) => {
        target.on('change', handleDocChange);
        target.on('delete', handleDocDelete);
      };

      const stopListeningTo = (target: DocHandle<SharedContent>) => {
        target.off('change', handleDocChange);
        target.off('delete', handleDocDelete);
      };

      listenTo(canonical);

      // Continues on another document. From here everything anchors in it;
      // contributions still in flight against the old one are dropped by
      // `commitText`. Published unconditionally: even with the text
      // unchanged, subscribers must learn the version to derive their next
      // base from.
      const continueOn = (next: DocHandle<SharedContent>) =>
        pipe(
          Effect.sync(() => {
            stopListeningTo(canonical);
            canonical = next;
            listenTo(canonical);
            lastContribution = null;
          }),
          Effect.zipRight(
            Effect.suspend(() => SubscriptionRef.set(content, readChange()))
          )
        );

      const attachTo = (address: LiveDocumentAddress) =>
        pipe(
          resolveSyncedDocument({ repo: syncedRepo, address }),
          Effect.flatMap(continueOn)
        );

      const detach = pipe(
        SubscriptionRef.get(content),
        Effect.flatMap((current) =>
          resolvePrivateDocument({
            repo: privateRepo,
            content: current.doc.content,
          })
        ),
        Effect.flatMap(continueOn)
      );

      return {
        content,
        change,
        attachTo,
        detach,
        close: Effect.sync(() => stopListeningTo(canonical)),
      };
    })
  );
