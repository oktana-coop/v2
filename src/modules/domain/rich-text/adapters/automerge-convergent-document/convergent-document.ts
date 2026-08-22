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
import { SharedDocumentUnavailableError } from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
} from '../../models';
import {
  type ConvergentDocument,
  type ConvergentDocumentAddress,
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentState,
  type ConvergentDocumentVersion,
} from '../../ports/convergent-document';
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

export type AutomergeConvergentDocumentDeps = {
  handle: DocHandle<SharedContent>;
  // Where documents live: this app's own in the repo that never syncs,
  // shared ones in the repo that does. Effects, so nothing dials the sync
  // service until a document is actually shared or joined.
  privateRepo: Effect.Effect<Repo>;
  syncedRepo: Effect.Effect<Repo, SyncServiceError>;
  onError: (error: unknown) => void;
};

// Automerge identifies a state by its heads; sorting makes the encoding
// independent of the order they are reported in.
const encodeVersion = (heads: UrlHeads): ConvergentDocumentVersion =>
  [...heads].sort().join(',');

const decodeVersion = (version: ConvergentDocumentVersion): UrlHeads =>
  version.split(',') as UrlHeads;

export const createConvergentDocument = ({
  handle,
  privateRepo,
  syncedRepo,
  onError,
}: AutomergeConvergentDocumentDeps): Effect.Effect<ConvergentDocument> =>
  pipe(
    SubscriptionRef.make<ConvergentDocumentState>({
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

      const readChange = (): ConvergentDocumentState => ({
        doc: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content: canonical.doc().content,
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

      const attachTo = (address: ConvergentDocumentAddress) =>
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
