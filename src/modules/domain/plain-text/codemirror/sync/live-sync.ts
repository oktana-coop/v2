import {
  Annotation,
  type EditorState,
  type Extension,
  StateEffect,
  StateField,
  Transaction,
} from '@codemirror/state';
import { type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { runOnLatestRefChange } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import {
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentVersion,
} from '../../../collaboration';
import { WebEditorError } from '../../errors';
import { type PlainTextDocument, plainTextDocument } from '../../models';
import { type PlainTextConvergentDocumentState } from '../../ports';
import { changesBetween } from './text-changes';

// What the editor shows of the live document, so that other extensions can
// read it.
export type LiveSyncState = {
  // The version the editor's text is built on.
  baseVersion: ConvergentDocumentVersion;
  // Whether local edits are still on their way to the live document, in
  // which case the editor's text is ahead of that version.
  hasPendingLocalEdits: boolean;
};

// After this transaction, the editor shows this version.
const showsVersion = StateEffect.define<ConvergentDocumentVersion>();

// Marks the transactions that bring the live document's state into the
// editor, which are not local edits.
const incoming = Annotation.define<boolean>();

const liveSyncField = StateField.define<LiveSyncState>({
  create: () => ({ baseVersion: '', hasPendingLocalEdits: false }),
  // A transaction that brings a version brings the editor to it; a local edit
  // is pending until the document resolves it with one.
  update: (current, tr) => {
    const version = tr.effects.find((effect) => effect.is(showsVersion));

    if (version) {
      return {
        baseVersion: version.value,
        hasPendingLocalEdits: false,
      };
    }

    return tr.docChanged ? { ...current, hasPendingLocalEdits: true } : current;
  },
});

export const getLiveSyncState = (state: EditorState): LiveSyncState =>
  state.field(liveSyncField);

export type LiveSyncArgs = {
  content: SubscriptionRef.SubscriptionRef<PlainTextConvergentDocumentState>;
  onChange: (
    doc: PlainTextDocument,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  // The version of the text the editor starts with.
  initialVersion: ConvergentDocumentVersion;
  onError: (error: unknown) => void;
};

// Keeps the editor and a live plain-text document in step: local edits are
// contributed as the editor's whole text, anchored at the version it shows,
// and states published by the document reach the editor as changes to the
// regions that differ, kept out of the undo history.
export const liveSync = ({
  content,
  onChange,
  initialVersion,
  onError,
}: LiveSyncArgs): Extension => [
  liveSyncField.init(() => ({
    baseVersion: initialVersion,
    hasPendingLocalEdits: false,
  })),
  ViewPlugin.define((view) => {
    let destroyed = false;

    // Local edits handed to the document, not yet resolved with a version.
    const contributionsInFlight = Effect.runSync(SubscriptionRef.make(0));

    // Resolves once no contribution is in flight, right away when none is.
    const whenNoContributionInFlight: Effect.Effect<void> = pipe(
      contributionsInFlight.changes,
      Stream.filter((count) => count === 0),
      Stream.runHead,
      Effect.asVoid
    );

    const markContributionAsResolved = (
      version?: ConvergentDocumentVersion
    ) => {
      const remainingInFlight =
        Effect.runSync(SubscriptionRef.get(contributionsInFlight)) - 1;

      if (remainingInFlight === 0 && version !== undefined && !destroyed) {
        view.dispatch({ effects: showsVersion.of(version) });
      }

      Effect.runSync(
        SubscriptionRef.set(contributionsInFlight, remainingInFlight)
      );
    };

    const contribute = (editorView: EditorView) => {
      Effect.runSync(
        SubscriptionRef.update(contributionsInFlight, (count) => count + 1)
      );

      // Not awaited, since view updates are synchronous. Once the
      // contribution resolves, the version it brings is recorded, so that
      // its echo is recognized by that version.
      Effect.runPromise(
        onChange(plainTextDocument(editorView.state.doc.toString()), {
          base: getLiveSyncState(editorView.state).baseVersion,
        })
      ).then(
        (version) => {
          markContributionAsResolved(version);
        },
        (error) => {
          markContributionAsResolved();
          onError(error);
        }
      );
    };

    const applyToView = (latest: PlainTextConvergentDocumentState) => {
      const changes = changesBetween({
        before: view.state.doc.toString(),
        after: latest.doc.content,
      });

      // A state the editor already shows still names a version to adopt.
      view.dispatch({
        changes,
        effects: showsVersion.of(latest.version),
        annotations: [incoming.of(true), Transaction.addToHistory.of(false)],
      });
    };

    // Brings the editor to the latest published state. It waits for
    // contributions in flight first: a state published meanwhile may be
    // their own echo, which only its version tells apart, and that is known
    // once they resolve. Nothing can be typed between reading the state and
    // applying it, since both happen in one go.
    const applyLatest: Effect.Effect<void> = pipe(
      whenNoContributionInFlight,
      Effect.zipRight(SubscriptionRef.get(content)),
      Effect.flatMap((latest) =>
        destroyed || latest.version === getLiveSyncState(view.state).baseVersion
          ? Effect.void
          : Effect.try({
              try: () => applyToView(latest),
              catch: mapErrorTo(
                WebEditorError,
                'Failed to apply a change to the editor'
              ),
            })
      ),
      // Recover per change, so one bad change doesn't stop syncing.
      Effect.catchAll((error) => Effect.sync(() => onError(error)))
    );

    const unsubscribe = runOnLatestRefChange(content, applyLatest);

    return {
      update: (update: ViewUpdate) => {
        const hasLocalEdits = update.transactions.some(
          (tr) => tr.docChanged && !tr.annotation(incoming)
        );

        if (hasLocalEdits) contribute(update.view);
      },
      destroy: () => {
        destroyed = true;
        unsubscribe();
      },
    };
  }),
];
