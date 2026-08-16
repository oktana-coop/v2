import * as Automerge from '@automerge/automerge/slim';
import {
  type DocHandle,
  type Repo,
  type UrlHeads,
} from '@automerge/automerge-repo/slim';
import debounce from 'debounce';
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

// The live document in full: the canonical CRDT document plus its two local
// sources — the editor contributing through `change`, the disk followed
// through the watcher and written through persistence. Peers, when the
// canonical document is shared, arrive through automerge-repo sync. One
// mutex serializes every mutation, so plain local state carries all
// bookkeeping.

export type Unsubscribe = () => void;

export type AutomergeLiveDocumentDeps = {
  handle: DocHandle<SharedContent>;
  // Where documents live: this app's own in the repo that never syncs,
  // shared ones in the repo that does. Effects, so nothing dials the sync
  // service until a document is actually shared or joined.
  privateRepo: Effect.Effect<Repo>;
  syncedRepo: Effect.Effect<Repo, SyncServiceError>;
  // Disk operations are neutral: the composition closes over project and
  // document identity. `initialText` is what the store read at open.
  initialText: string;
  readDocument: Effect.Effect<RichTextDocument | null, unknown>;
  writeDocument: (doc: RichTextDocument) => Effect.Effect<string, unknown>;
  subscribeToDocumentChanges: (listener: () => void) => Unsubscribe;
  transformToText: RepresentationTransform['transformToText'];
  onError: (error: unknown) => void;
};

export type AutomergeLiveDocument = LiveDocument & {
  flush: Effect.Effect<void>;
  refresh: Effect.Effect<void>;
  cancelPendingPersist: Effect.Effect<void>;
};

const PERSIST_DEBOUNCE_MS = 300;

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
  initialText,
  readDocument,
  writeDocument,
  subscribeToDocumentChanges,
  transformToText,
  onError,
}: AutomergeLiveDocumentDeps): Effect.Effect<AutomergeLiveDocument> =>
  pipe(
    Effect.all({
      content: SubscriptionRef.make<LiveDocumentChange>({
        doc: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content: handle.doc().content,
        },
        version: encodeVersion(handle.heads()),
      }),
      semaphore: Effect.makeSemaphore(1),
    }),
    Effect.map(({ content, semaphore }) => {
      const mutex = semaphore.withPermits(1);

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

      // What the disk holds, as far as this document knows: the text last
      // written or read, and the version it derives from.
      let lastPersisted = {
        content: initialText,
        version: encodeVersion(handle.heads()),
      };
      let cancelledVersion: LiveDocumentVersion | null = null;

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

      // ---- the editor source ------------------------------------------

      // Keystrokes can outpace their conversions, so contributions may
      // share a base while each extends the previous one. The intake
      // remembers the previous contribution: that is the state such a
      // contribution actually derives from.
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
          Effect.flatMap((text) =>
            mutex(
              Effect.sync(() => {
                if (intake !== latestIntake) return currentVersion();

                const base = options?.base;
                const anchor =
                  base !== undefined && lastContribution?.base === base
                    ? lastContribution.result
                    : base;

                const result = commitText(text, anchor);
                if (base !== undefined) lastContribution = { base, result };
                return result;
              })
            )
          ),
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

      // ---- the disk source --------------------------------------------

      const persist = pipe(
        SubscriptionRef.get(content),
        Effect.flatMap((current) =>
          current.doc.content === lastPersisted.content ||
          current.version === cancelledVersion
            ? Effect.void
            : pipe(
                writeDocument(current.doc),
                Effect.map((written) => {
                  lastPersisted = {
                    content: written,
                    version: current.version,
                  };
                })
              )
        )
      );

      const flush = mutex(
        pipe(
          Effect.sync(() => debouncedPersist.clear()),
          Effect.zipRight(persist),
          Effect.catchAll((error) => Effect.sync(() => onError(error)))
        )
      );

      const debouncedPersist = debounce(() => {
        Effect.runPromise(flush).catch(onError);
      }, PERSIST_DEBOUNCE_MS);

      // Marks the content as of now as not-to-persist; any later change
      // produces a new version, which persists again.
      const cancelPendingPersist = mutex(
        pipe(
          Effect.sync(() => debouncedPersist.clear()),
          Effect.zipRight(SubscriptionRef.get(content)),
          Effect.flatMap((current) =>
            Effect.sync(() => {
              cancelledVersion = current.version;
            })
          )
        )
      );

      // A disk change that matches what this document last wrote or read is
      // its own echo; anything else was another hand, contributed like any
      // other source and anchored at the state the disk derived from.
      const refresh = mutex(
        pipe(
          Effect.suspend(() => readDocument),
          Effect.flatMap((fresh) =>
            fresh === null || fresh.content === lastPersisted.content
              ? Effect.void
              : Effect.sync(() => {
                  const version = commitText(
                    fresh.content,
                    lastPersisted.version
                  );
                  lastPersisted = { content: fresh.content, version };
                })
          ),
          Effect.catchAll((error) => Effect.sync(() => onError(error)))
        )
      );

      // ---- the canonical document -------------------------------------

      const publish = pipe(
        SubscriptionRef.get(content),
        Effect.flatMap((current) => {
          const next = readChange();
          // Heads can move without the text moving; subscribers only care
          // about the text.
          return current.doc.content === next.doc.content
            ? Effect.void
            : pipe(
                SubscriptionRef.set(content, next),
                // The disk follows the live document: any new state, from
                // any source, arms a write.
                Effect.zipRight(Effect.sync(() => debouncedPersist()))
              );
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
        mutex(
          pipe(
            Effect.sync(() => {
              stopListeningTo(canonical);
              canonical = next;
              listenTo(canonical);
              lastContribution = null;
              cancelledVersion = null;
              lastPersisted = {
                content: lastPersisted.content,
                version: currentVersion(),
              };
            }),
            Effect.zipRight(
              Effect.suspend(() => SubscriptionRef.set(content, readChange()))
            )
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

      const unsubscribeFromDisk = subscribeToDocumentChanges(() => {
        Effect.runPromise(refresh).catch(onError);
      });

      // Unsubscribe first, so the echo of the closing flush cannot start a
      // refresh on a document that is going away.
      const close = pipe(
        Effect.sync(() => unsubscribeFromDisk()),
        Effect.zipRight(flush),
        Effect.zipRight(Effect.sync(() => stopListeningTo(canonical)))
      );

      return {
        content,
        change,
        attachTo,
        detach,
        flush,
        refresh,
        cancelPendingPersist,
        close,
      };
    })
  );
