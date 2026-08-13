import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Node, type Schema } from 'prosemirror-model';
import { type EditorState, Plugin, PluginKey } from 'prosemirror-state';

import { forEachLatestRefChange } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import {
  RepresentationTransformError,
  ValidationError,
  WebEditorError,
} from '../../errors';
import { type RichTextDocument, richTextRepresentations } from '../../models';
import {
  type LiveDocument,
  type LiveDocumentChange,
  type LiveDocumentVersion,
} from '../../ports/live-document';
import { ensureTrailingParagraphInDoc } from '../blocks';
import { pmDocFromJSONString, pmDocToJSONString } from '../json';

const pluginKey = new PluginKey('pm-live-sync');

export type LiveSyncPluginArgs = {
  liveDocument: LiveDocument;
  initialVersion: LiveDocumentVersion;
  schemaVersion: number;
  schema: Schema;
  convertToProseMirror: (doc: RichTextDocument) => Promise<Node>;
  onError: (error: unknown) => void;
};

export const liveSyncPlugin = ({
  liveDocument,
  initialVersion,
  schemaVersion,
  schema,
  convertToProseMirror,
  onError,
}: LiveSyncPluginArgs) =>
  new Plugin({
    key: pluginKey,
    view(view) {
      // The version currently shown in the editor.
      let editorDocVersion = initialVersion;
      let applyingIncoming = false;
      // While own contributions are in flight, a published state can lag the
      // editor's own text; applying it would wipe those keystrokes and throw
      // the caret. Once they resolve, the published state contains them, so
      // what remains to apply is remote — away from the caret.
      let contributionsInFlight = 0;

      const toProseMirrorDoc = (
        doc: RichTextDocument
      ): Effect.Effect<Node, RepresentationTransformError | ValidationError> =>
        doc.representation === richTextRepresentations.PROSEMIRROR
          ? Effect.try({
              try: () => pmDocFromJSONString(JSON.parse(doc.content), schema),
              catch: mapErrorTo(
                ValidationError,
                'Invalid stored ProseMirror document'
              ),
            })
          : Effect.tryPromise({
              try: () => convertToProseMirror(doc),
              catch: mapErrorTo(
                RepresentationTransformError,
                'Failed to convert the document to ProseMirror'
              ),
            });

      // States this editor contributed, kept until their echoes come back:
      // an incoming state equal to one of them carries nothing the editor
      // doesn't already show, and applying it would wipe keystrokes whose
      // contributions are still in flight.
      const contributedDocs: Node[] = [];

      const rememberContributed = (doc: Node) => {
        contributedDocs.push(doc);
        if (contributedDocs.length > 20) contributedDocs.shift();
      };

      const isContributedState = (doc: Node) =>
        contributedDocs.some((contributed) => contributed.eq(doc));

      // Replaces only the slice that differs, so the selection — and the
      // user's caret — keeps its place through changes landing elsewhere.
      const minimalReplace = (state: EditorState, newPmDoc: Node) => {
        const start = state.doc.content.findDiffStart(newPmDoc.content);
        const end = state.doc.content.findDiffEnd(newPmDoc.content);

        if (start === null || end === null) return null;

        let { a: endA, b: endB } = end;
        const overlap = start - Math.min(endA, endB);
        if (overlap > 0) {
          endA += overlap;
          endB += overlap;
        }

        return state.tr.replace(start, endA, newPmDoc.slice(start, endB));
      };

      const applyIncoming = ({
        change,
        newPmDoc,
      }: {
        change: LiveDocumentChange;
        newPmDoc: Node;
      }) => {
        const { state } = view;
        const tr =
          minimalReplace(state, newPmDoc) ??
          state.tr.replaceWith(0, state.doc.content.size, newPmDoc.content);

        tr.setMeta('addToHistory', false);
        tr.setMeta(pluginKey, { fromLiveDocument: true });

        applyingIncoming = true;
        try {
          view.dispatch(tr);
        } finally {
          applyingIncoming = false;
        }

        editorDocVersion = change.version;
      };

      const applyToView = ({
        change,
        newPmDoc,
      }: {
        change: LiveDocumentChange;
        newPmDoc: Node;
      }): Effect.Effect<void, WebEditorError> =>
        Effect.try({
          try: () => {
            // Re-checked here because the conversion above took time: a
            // contribution made meanwhile puts the editor ahead of this
            // state again. Dropping it is safe — that contribution's
            // resolution publishes a newer state.
            if (contributionsInFlight > 0) return;

            // Likewise, a state the live document has already moved past
            // may lag contributions that resolved during the conversion.
            // The newer state is on its way through the buffer.
            const latest = Effect.runSync(
              SubscriptionRef.get(liveDocument.content)
            );
            if (latest.version !== change.version) return;

            // The editor keeps a trailing paragraph after some blocks, which
            // the primary representation cannot express: normalized to the
            // editor's shape, an unchanged document reads as unchanged.
            const incoming = ensureTrailingParagraphInDoc(newPmDoc, schema);

            if (incoming.eq(view.state.doc)) {
              editorDocVersion = change.version;
            } else if (isContributedState(incoming)) {
              // A stale echo: the editor is already ahead of it. Applying it
              // would wipe the newer keystrokes, and adopting its version
              // would rewind the base beneath their contributions.
            } else {
              applyIncoming({ change, newPmDoc: incoming });
            }
          },
          catch: mapErrorTo(
            WebEditorError,
            'Failed to apply a change to the editor'
          ),
        });

      const whenNoContributionInFlight: Effect.Effect<void> = Effect.suspend(
        () =>
          contributionsInFlight === 0
            ? Effect.void
            : pipe(
                Effect.sleep('10 millis'),
                Effect.flatMap(() => whenNoContributionInFlight)
              )
      );

      // forEachLatestRefChange collapses a burst of changes to just the latest
      // while a slow apply is in flight; the version guard then skips it when
      // it already matches what's shown.
      const applyChange = (change: LiveDocumentChange) =>
        pipe(
          // Applying waits out own contributions: a state published while one
          // is in flight can lag the editor's own text, and applying it would
          // wipe those keystrokes and throw the caret. The sliding buffer
          // keeps the newest state while this apply holds.
          whenNoContributionInFlight,
          Effect.flatMap(() =>
            change.version === editorDocVersion
              ? Effect.void
              : pipe(
                  toProseMirrorDoc(change.doc),
                  Effect.flatMap((newPmDoc) =>
                    applyToView({ change, newPmDoc })
                  )
                )
          ),
          // Recover per change, so one bad change doesn't stop syncing.
          Effect.catchAll((error) => Effect.sync(() => onError(error)))
        );

      const unsubscribe = forEachLatestRefChange(
        liveDocument.content,
        applyChange
      );

      return {
        // React to local ProseMirror changes
        update(view, prevState) {
          if (applyingIncoming) return;
          if (view.state.doc.eq(prevState.doc)) return;

          rememberContributed(view.state.doc);

          const doc: RichTextDocument = {
            schemaVersion,
            representation: richTextRepresentations.PROSEMIRROR,
            content: pmDocToJSONString(view.state.doc),
          };

          // update() is synchronous, so run the change as a fire-and-forget task.
          contributionsInFlight += 1;
          Effect.runPromise(
            liveDocument.change(doc, { base: editorDocVersion })
          ).finally(() => {
            contributionsInFlight -= 1;
          });
        },
        destroy() {
          unsubscribe();
        },
      };
    },
  });
