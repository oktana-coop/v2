import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Fragment, type Node, type Schema } from 'prosemirror-model';
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
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentState,
  type ConvergentDocumentVersion,
} from '../../ports/convergent-document';
import { ensureTrailingParagraphInDoc } from '../blocks';
import { pmDocFromJSONString, pmDocToJSONString } from '../json';

const pluginKey = new PluginKey('pm-live-sync');

export type LiveSyncPluginArgs = {
  content: SubscriptionRef.SubscriptionRef<ConvergentDocumentState>;
  onChange: (
    doc: RichTextDocument,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  initialVersion: ConvergentDocumentVersion;
  schemaVersion: number;
  schema: Schema;
  convertToProseMirror: (doc: RichTextDocument) => Promise<Node>;
  onError: (error: unknown) => void;
};

export const liveSyncPlugin = ({
  content,
  onChange,
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
      // A published state can lag typing still in flight; a diff cannot
      // tell that apart from a remote deletion.
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

      // The span of one fragment that differs from another, as positions
      // within them.
      const differingSlice = (a: Fragment, b: Fragment) => {
        const start = a.findDiffStart(b);
        const end = a.findDiffEnd(b);

        if (start === null || end === null) return null;

        let { a: endA, b: endB } = end;
        const overlap = start - Math.min(endA, endB);
        if (overlap > 0) {
          endA += overlap;
          endB += overlap;
        }

        return { start, endA, endB };
      };

      // Where each top-level block starts. Cheap: node sizes, no descent.
      const blockOffsets = (doc: Node) => {
        const offsets: number[] = [];
        let pos = 0;

        doc.forEach((block) => {
          offsets.push(pos);
          pos += block.nodeSize;
        });

        return offsets;
      };

      // Replaces just the blocks that differ within the changed span. A burst
      // of edits arrives as a single change, so the span between the first and
      // last difference can cover blocks nobody touched — and replacing one the
      // caret sits in moves the caret to the edge of the splice.
      //
      // Only blocks meeting the span are compared, so a lone edit costs what it
      // did before. Block-level structure changes leave the indexes unpaired,
      // and those fall back to the single splice.
      // TODO: replace with v2-hs-lib's diffToTransaction once it exists —
      // minimal steps at exact positions, which narrows this within a block too.
      const replaceChangedBlocks = ({
        state,
        newPmDoc,
        start,
        endA,
      }: {
        state: EditorState;
        newPmDoc: Node;
        start: number;
        endA: number;
      }) => {
        if (state.doc.childCount !== newPmDoc.childCount) return null;

        const offsets = blockOffsets(state.doc);
        const changed: number[] = [];

        for (let index = 0; index < state.doc.childCount; index += 1) {
          const block = state.doc.child(index);
          const blockStart = offsets[index]!;
          const blockEnd = blockStart + block.nodeSize;

          // Everything outside the span is identical by construction.
          if (blockEnd < start || blockStart > endA) continue;
          if (block.eq(newPmDoc.child(index))) continue;

          changed.push(index);
        }

        if (changed.length === 0) return null;

        const tr = state.tr;

        // Later blocks first, so replacing one cannot move the next one's
        // position out from under us.
        for (const index of [...changed].reverse()) {
          const blockStart = offsets[index]!;
          const block = state.doc.child(index);
          const newBlock = newPmDoc.child(index);
          const inner = differingSlice(block.content, newBlock.content);

          if (inner === null) {
            // Same text, different markup: the block goes as a whole.
            tr.replaceWith(blockStart, blockStart + block.nodeSize, newBlock);
            continue;
          }

          // Past the block's own opening token.
          const base = blockStart + 1;

          tr.replace(
            base + inner.start,
            base + inner.endA,
            newBlock.slice(inner.start, inner.endB)
          );
        }

        return tr;
      };

      const minimalReplace = (state: EditorState, newPmDoc: Node) => {
        const span = differingSlice(state.doc.content, newPmDoc.content);

        if (span === null) return null;

        return (
          replaceChangedBlocks({
            state,
            newPmDoc,
            start: span.start,
            endA: span.endA,
          }) ??
          state.tr.replace(
            span.start,
            span.endA,
            newPmDoc.slice(span.start, span.endB)
          )
        );
      };

      const applyIncoming = ({
        change,
        newPmDoc,
      }: {
        change: ConvergentDocumentState;
        newPmDoc: Node;
      }) => {
        const { state } = view;
        const tr =
          minimalReplace(state, newPmDoc) ??
          state.tr.replaceWith(0, state.doc.content.size, newPmDoc.content);

        tr.setMeta('addToHistory', false);
        tr.setMeta(pluginKey, { incoming: true });

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
        change: ConvergentDocumentState;
        newPmDoc: Node;
      }): Effect.Effect<void, WebEditorError> =>
        Effect.try({
          try: () => {
            // The editor keeps a trailing paragraph the primary
            // representation cannot express.
            const incoming = ensureTrailingParagraphInDoc(newPmDoc, schema);

            if (incoming.eq(view.state.doc)) {
              editorDocVersion = change.version;
            } else {
              applyIncoming({ change, newPmDoc: incoming });
            }
          },
          catch: mapErrorTo(
            WebEditorError,
            'Failed to apply a change to the editor'
          ),
        });

      // forEachLatestRefChange collapses a burst of changes to just the latest
      // while a slow apply is in flight; the version check before converting
      // to ProseMirror then skips it when it already matches what's shown.
      const applyChange = (change: ConvergentDocumentState) =>
        pipe(
          change.version === editorDocVersion
            ? Effect.void
            : pipe(
                toProseMirrorDoc(change.doc),
                // Converting to ProseMirror is asynchronous and other work runs
                // while it suspends, so we have to repeat some checks before applying.
                Effect.flatMap((newPmDoc) =>
                  pipe(
                    SubscriptionRef.get(content),
                    Effect.flatMap((latest) => {
                      const shouldSkip =
                        // The editor already shows this version;
                        change.version === editorDocVersion ||
                        // Typing that has not reached the document yet.
                        // Dropping is safe: the resolving contribution
                        // publishes a superseding state that carries it.
                        contributionsInFlight > 0 ||
                        // A state the document moved past while it converted;
                        // the newer one is on its way through the buffer.
                        latest.version !== change.version;

                      return shouldSkip
                        ? Effect.void
                        : applyToView({ change, newPmDoc });
                    })
                  )
                )
              ),
          // Recover per change, so one bad change doesn't stop syncing.
          Effect.catchAll((error) => Effect.sync(() => onError(error)))
        );

      const unsubscribe = forEachLatestRefChange(content, applyChange);

      return {
        // React to local ProseMirror changes
        update(view, prevState) {
          if (applyingIncoming) return;
          if (view.state.doc.eq(prevState.doc)) return;

          const doc: RichTextDocument = {
            schemaVersion,
            representation: richTextRepresentations.PROSEMIRROR,
            content: pmDocToJSONString(view.state.doc),
          };

          contributionsInFlight += 1;

          // `onChange` resolution is not awaited, therefore the version it
          // resolves with is recorded as `editorDocVersion` whenever it
          // completes. This helps the editor detect when a regular change is
          // an echo of local typing.
          Effect.runPromise(onChange(doc, { base: editorDocVersion }))
            .then((version) => {
              editorDocVersion = version;
            })
            .finally(() => {
              contributionsInFlight -= 1;
            });
        },
        destroy() {
          unsubscribe();
        },
      };
    },
  });
