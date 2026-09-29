import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Node as PMNode } from 'prosemirror-model';
import {
  EditorState,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';
import { ReplaceStep, replaceStep } from 'prosemirror-transform';
import { EditorView } from 'prosemirror-view';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  promiseWithResolvers,
  useFakeTimersInTest,
} from '../../../../../utils/test-utils';
import {
  LiveSyncFallbackError,
  PatchError,
  RepresentationTransformError,
  RichTextLibError,
  WebEditorError,
} from '../../errors';
import {
  type ConvergentDocumentVersion,
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RemotePresence,
  type RichTextDocument,
  richTextRepresentations,
} from '../../models';
import {
  type ConvergentDocument,
  type ConvergentDocumentState,
} from '../../ports/convergent-document';
import { type ProseMirrorStepsResult } from '../../ports/diff-patch';
import { markdownDocument } from '../../test-utils';
import { pmDocFromJSONString } from '../json';
import { schema } from '../schema';
import { doc, para, textSlice } from '../test-utils';
import {
  getLiveSyncState,
  liveSyncPlugin,
  type LiveSyncPluginArgs,
} from './live-sync-plugin';

// Nobody else is at these documents.
const noPresence: Effect.Effect<ConvergentDocument['presence']> = pipe(
  SubscriptionRef.make<ReadonlyArray<RemotePresence>>([]),
  Effect.map((peers) => ({ peers, publish: () => Effect.void }))
);

// The editor contributes its own representation; everything else is already
// the primary text one.
const textOf = (doc: RichTextDocument) =>
  doc.representation === richTextRepresentations.PROSEMIRROR
    ? pmDocFromJSONString(JSON.parse(doc.content), schema).textContent
    : doc.content;

type ProseMirrorSteps = LiveSyncPluginArgs['proseMirrorSteps'];

// The minimal steps from one editor doc to another: one step covering only
// the changed region, so a caret outside it stays where it is.
const stepsBetween = ({
  pmDocBefore,
  pmDocAfter,
}: {
  pmDocBefore: PMNode;
  pmDocAfter: PMNode;
}): ProseMirrorStepsResult => {
  const start = pmDocBefore.content.findDiffStart(pmDocAfter.content);
  const end = pmDocBefore.content.findDiffEnd(pmDocAfter.content);
  if (start === null || end === null) return { pmDocAfter, steps: [] };

  const overlap = Math.max(0, start - Math.min(end.a, end.b));
  const step = replaceStep(
    pmDocBefore,
    start,
    end.a + overlap,
    pmDocAfter.slice(start, end.b + overlap)
  );

  return { pmDocAfter, steps: step ? [step] : [] };
};

// The plugin syncs in the background, where the test can't await it;
// `eventually` polls its assertions until they hold.
const eventually = (assertions: () => void | Promise<void>) =>
  vi.waitFor(assertions);

// A convergent document holding text in memory, versioned by a counter. The
// editor only needs a document that publishes and versions what it is given;
// convergence itself is the real convergent document's concern.
const createConvergentDocumentInMemory = (
  initialText: string
): Promise<ConvergentDocument> =>
  Effect.runPromise(
    pipe(
      Effect.all({
        content: SubscriptionRef.make<ConvergentDocumentState>({
          doc: markdownDocument(initialText),
          version: 'v0',
        }),
        presence: noPresence,
      }),
      Effect.map(({ content, presence }) => {
        let versions = 0;

        const change = (text: string) =>
          pipe(
            SubscriptionRef.get(content),
            Effect.flatMap((previous) =>
              // Publishing equal content would look like a change to the
              // editor, so it has to short-circuit before the set.
              previous.doc.content === text
                ? Effect.succeed(previous.version)
                : SubscriptionRef.modify(content, () => {
                    versions += 1;
                    const version = `v${versions}`;

                    // [effect result, new state].
                    return [version, { doc: markdownDocument(text), version }];
                  })
            )
          );

        return {
          content,
          change,
          presence,
          errors: Stream.empty,
          close: Effect.void,
        };
      })
    )
  );

// The plugin also dispatches to record versions; only edits touch the doc.
const editsIn = (transactions: Transaction[]) =>
  transactions.filter((tr) => tr.docChanged);

const setUpEditor = async ({
  initialText = 'hello',
}: { initialText?: string } = {}) => {
  const liveDocument = await createConvergentDocumentInMemory(initialText);
  const initial = await Effect.runPromise(
    SubscriptionRef.get(liveDocument.content)
  );

  // Stands in for what the command does around the document: contributions
  // arrive in the editor's representation and reach it as primary text.
  const onChange = vi.fn<LiveSyncPluginArgs['onChange']>((doc, options) =>
    liveDocument.change(textOf(doc), options)
  );
  // The steps to the incoming doc, asynchronous like the real computation so
  // the checks after the await see the same interleavings.
  const proseMirrorSteps = vi.fn<ProseMirrorSteps>(
    ({ pmDocBefore, docAfter }) =>
      Effect.promise(async () =>
        stepsBetween({ pmDocBefore, pmDocAfter: doc([para(textOf(docAfter))]) })
      )
  );
  const convertToProseMirror = vi.fn<
    LiveSyncPluginArgs['convertToProseMirror']
  >(async (richText) => doc([para(textOf(richText))]));
  const onError = vi.fn<LiveSyncPluginArgs['onError']>();

  const state = EditorState.create({
    schema,
    doc: doc([para(initialText)]),
    plugins: [
      liveSyncPlugin({
        content: liveDocument.content,
        onChange,
        initialVersion: initial.version,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        schema,
        proseMirrorSteps,
        convertToProseMirror,
        onError,
      }),
    ],
  });

  const dispatchTransaction = vi.fn((tr: Transaction) => {
    view.updateState(view.state.apply(tr));
  });
  const view: EditorView = new EditorView(document.createElement('div'), {
    state,
    dispatchTransaction,
  });
  onTestFinished(() => {
    view.destroy();
  });

  return {
    liveDocument,
    view,
    onChange,
    proseMirrorSteps,
    convertToProseMirror,
    onError,
    // Every transaction dispatched to the view, in order.
    dispatched: () => dispatchTransaction.mock.calls.map(([tr]) => tr),
  };
};

describe('liveSyncPlugin', () => {
  describe('local edits', () => {
    it('sends local edits to the live document', async () => {
      const { liveDocument, view } = await setUpEditor();

      view.dispatch(view.state.tr.insertText(' world', 6));

      await eventually(async () => {
        const current = await Effect.runPromise(
          SubscriptionRef.get(liveDocument.content)
        );
        // What reaches the document is the primary text representation,
        // whatever the editor contributed.
        expect(current.doc.representation).toBe(
          PRIMARY_RICH_TEXT_REPRESENTATION
        );
        expect(current.doc.content).toBe('hello world');
      });
    });

    it('anchors local edits at the version shown in the editor', async () => {
      const { liveDocument, view, onChange } = await setUpEditor();

      view.dispatch(view.state.tr.insertText(' world', 6));

      await eventually(() => expect(onChange).toHaveBeenCalledTimes(1));
      expect(onChange).toHaveBeenLastCalledWith(expect.anything(), {
        base: 'v0',
      });

      const peerVersion = await Effect.runPromise(
        liveDocument.change('from a peer')
      );
      await eventually(() =>
        expect(view.state.doc.textContent).toBe('from a peer')
      );

      view.dispatch(view.state.tr.insertText('!', 1));

      await eventually(() => expect(onChange).toHaveBeenCalledTimes(2));
      expect(onChange).toHaveBeenLastCalledWith(expect.anything(), {
        base: peerVersion,
      });
    });
  });

  describe('incoming states', () => {
    it("applies a peer's change as one transaction, kept out of the undo history", async () => {
      const { liveDocument, view, dispatched } = await setUpEditor();

      await Effect.runPromise(liveDocument.change('from a peer'));

      await eventually(() =>
        expect(view.state.doc.textContent).toBe('from a peer')
      );
      const transactions = dispatched();
      expect(transactions).toHaveLength(1);
      expect(transactions[0].getMeta('addToHistory')).toBe(false);
    });

    it('keeps the caret in place when a change is made elsewhere in the document', async () => {
      const { liveDocument, view } = await setUpEditor({
        initialText: 'hello world',
      });

      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 6))
      );

      await Effect.runPromise(liveDocument.change('hello world and more'));

      await eventually(() =>
        expect(view.state.doc.textContent).toBe('hello world and more')
      );
      expect(view.state.selection.head).toBe(6);
    });

    it("keeps the caret between a peer's edits on both sides of it", async () => {
      const { liveDocument, view, dispatched, onError, proseMirrorSteps } =
        await setUpEditor({ initialText: 'hello world' });
      // A coarse replace would span both edits and drag the caret between them
      // to its end.
      proseMirrorSteps.mockReturnValue(
        Effect.succeed({
          pmDocAfter: doc([para('Xhello worldY')]),
          steps: [
            new ReplaceStep(1, 1, textSlice('X')),
            new ReplaceStep(13, 13, textSlice('Y')),
          ],
        })
      );

      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 6))
      );
      const dispatchedBefore = dispatched().length;

      await Effect.runPromise(liveDocument.change('Xhello worldY'));

      await eventually(() =>
        expect(view.state.doc.textContent).toBe('Xhello worldY')
      );
      expect(view.state.selection.head).toBe(7);
      const transactions = dispatched();
      expect(transactions).toHaveLength(dispatchedBefore + 1);
      expect(transactions[dispatchedBefore].steps).toHaveLength(2);
      expect(onError).not.toHaveBeenCalled();
    });

    it('computes steps for a state in ProseMirror representation too', async () => {
      const { liveDocument, view, proseMirrorSteps } = await setUpEditor();

      await Effect.runPromise(
        SubscriptionRef.set(liveDocument.content, {
          doc: {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            representation: richTextRepresentations.PROSEMIRROR,
            content: JSON.stringify(doc([para('from a peer')]).toJSON()),
          },
          version: 'r1',
        })
      );

      await eventually(() =>
        expect(view.state.doc.textContent).toBe('from a peer')
      );
      expect(proseMirrorSteps).toHaveBeenCalledTimes(1);
      expect(proseMirrorSteps.mock.calls[0][0].docAfter.representation).toBe(
        richTextRepresentations.PROSEMIRROR
      );
    });

    it('collapses changes that arrive faster than they can be applied', async () => {
      const { liveDocument, view, dispatched, proseMirrorSteps } =
        await setUpEditor();
      useFakeTimersInTest();
      const firstSteps = promiseWithResolvers<ProseMirrorStepsResult>();
      proseMirrorSteps.mockReturnValueOnce(
        Effect.promise(() => firstSteps.promise)
      );

      await Effect.runPromise(liveDocument.change('first'));
      await vi.waitFor(() => expect(proseMirrorSteps).toHaveBeenCalledOnce());
      // The other changes queue up while the first one's steps are still being
      // computed.
      for (const text of ['second', 'third', 'latest']) {
        await Effect.runPromise(liveDocument.change(text));
      }
      firstSteps.resolve(
        stepsBetween({
          pmDocBefore: doc([para('hello')]),
          pmDocAfter: doc([para('first')]),
        })
      );
      await vi.runAllTimersAsync();

      // The editor converged to the newest change, and the intermediates were
      // skipped: never one transaction per change, which is what no
      // conflation would produce.
      expect(view.state.doc.textContent).toBe('latest');
      expect(dispatched().length).toBeLessThanOrEqual(2);
    });

    it('does not wipe a keystroke made while an incoming state was converting', async () => {
      const { liveDocument, view, dispatched, proseMirrorSteps } =
        await setUpEditor();

      useFakeTimersInTest();

      const incomingSteps = promiseWithResolvers<ProseMirrorStepsResult>();
      proseMirrorSteps.mockReturnValueOnce(
        Effect.promise(() => incomingSteps.promise)
      );

      await Effect.runPromise(liveDocument.change('from a peer'));
      await vi.waitFor(() => expect(proseMirrorSteps).toHaveBeenCalledOnce());
      // The incoming state's steps are still being computed when a keystroke
      // comes in.
      view.dispatch(view.state.tr.insertText('!', 6));
      const editsAfterTyping = editsIn(dispatched()).length;

      // They arrive computed against the doc from before the keystroke.
      incomingSteps.resolve(
        stepsBetween({
          pmDocBefore: doc([para('hello')]),
          pmDocAfter: doc([para('from a peer')]),
        })
      );
      await vi.runAllTimersAsync();

      // The lagging state is dropped, never applied-then-healed: the editor
      // must not edit at all, and the keystroke must survive throughout.
      expect(view.state.doc.textContent).toContain('!');
      expect(editsIn(dispatched())).toHaveLength(editsAfterTyping);
    });
  });

  describe('contributions in flight and their echoes', () => {
    it('holds incoming changes while an own contribution is in flight', async () => {
      const { liveDocument, view, onChange } = await setUpEditor();
      useFakeTimersInTest();
      const firstVersion = promiseWithResolvers<ConvergentDocumentVersion>();
      const secondVersion = promiseWithResolvers<ConvergentDocumentVersion>();
      onChange
        .mockReturnValueOnce(Effect.promise(() => firstVersion.promise))
        .mockReturnValueOnce(Effect.promise(() => secondVersion.promise));

      view.dispatch(view.state.tr.insertText('!', 6));
      view.dispatch(view.state.tr.insertText('?', 7));

      await Effect.runPromise(
        SubscriptionRef.set(liveDocument.content, {
          doc: markdownDocument('from a peer'),
          version: 'r1',
        })
      );
      await vi.runAllTimersAsync();

      expect(view.state.doc.textContent).toBe('hello!?');

      // One contribution resolved, the other still on its way: still held.
      firstVersion.resolve('v1');
      await vi.runAllTimersAsync();

      expect(view.state.doc.textContent).toBe('hello!?');

      secondVersion.resolve('v2');
      await Effect.runPromise(
        SubscriptionRef.set(liveDocument.content, {
          doc: markdownDocument('hello!? from a peer'),
          version: 'r2',
        })
      );

      await eventually(() =>
        expect(view.state.doc.textContent).toBe('hello!? from a peer')
      );
    });

    // A state published while a contribution is in flight waits for it, then
    // applies once it resolves, with nothing published after.
    it('applies a state that arrived during a contribution once the contribution resolves', async () => {
      const { liveDocument, view, onChange } = await setUpEditor();
      useFakeTimersInTest();
      const contribution = promiseWithResolvers<ConvergentDocumentVersion>();
      onChange.mockReturnValueOnce(Effect.promise(() => contribution.promise));

      view.dispatch(view.state.tr.insertText('!', 6));
      // A peer's edit, merged with the '!' that reached the document.
      await Effect.runPromise(
        SubscriptionRef.set(liveDocument.content, {
          doc: markdownDocument('hello! from a peer'),
          version: 'r1',
        })
      );
      await vi.runAllTimersAsync();
      expect(view.state.doc.textContent).toBe('hello!');

      contribution.resolve('v1');

      await eventually(() =>
        expect(view.state.doc.textContent).toBe('hello! from a peer')
      );
    });

    // Typing comes back as a new state of the document: its echo. By the time
    // it arrives the user may have typed more, so it is an older state than
    // the editor shows, and only its version tells it is the editor's own.
    it('recognizes its own echo by version instead of applying it', async () => {
      const { liveDocument, view, onChange } = await setUpEditor();
      useFakeTimersInTest();

      // Typing '!' contributes 'hello!'. The document publishes it back
      // straight away as its new state: the echo. Its version reaches the editor
      // only when the test resolves it.
      const echo = { doc: markdownDocument('hello!'), version: 'v1' };
      const echoVersion = promiseWithResolvers<ConvergentDocumentVersion>();
      onChange.mockImplementationOnce(() =>
        pipe(
          SubscriptionRef.set(liveDocument.content, echo),
          Effect.zipRight(Effect.promise(() => echoVersion.promise))
        )
      );
      view.dispatch(view.state.tr.insertText('!', 6));

      // Typing '?' meanwhile; its contribution is still on its way.
      const nextVersion = promiseWithResolvers<ConvergentDocumentVersion>();
      onChange.mockImplementationOnce(() =>
        pipe(
          Effect.promise(() => nextVersion.promise),
          Effect.tap((version) =>
            SubscriptionRef.set(liveDocument.content, {
              doc: markdownDocument('hello!?'),
              version,
            })
          )
        )
      );
      view.dispatch(view.state.tr.insertText('?', 7));

      echoVersion.resolve('v1');
      await vi.runAllTimersAsync();

      // The echo is known as the editor's own, and the '?' is still on its way:
      // applying the echo would have lost it.
      expect(view.state.doc.textContent).toBe('hello!?');

      nextVersion.resolve('v2');
      await vi.runAllTimersAsync();

      expect(view.state.doc.textContent).toBe('hello!?');
    });

    // proseMirrorSteps brings the editor to changes that come from elsewhere.
    // Typing comes back too, as its echo, which the editor recognises by the
    // version its contribution resolves with.
    it('does not compute steps for its own echo', async () => {
      const { liveDocument, view, onChange, proseMirrorSteps } =
        await setUpEditor();
      useFakeTimersInTest();

      // Typing '!' contributes 'hello!'. The document publishes it back as its
      // new state, the echo, and resolves with the echo's version.
      const echo = { doc: markdownDocument('hello!'), version: 'v1' };
      onChange.mockImplementationOnce(() =>
        pipe(
          SubscriptionRef.set(liveDocument.content, echo),
          Effect.as(echo.version)
        )
      );
      view.dispatch(view.state.tr.insertText('!', 6));
      await vi.runAllTimersAsync();

      expect(onChange).toHaveBeenCalledOnce();
      // Computing steps is expensive, and the editor already shows its echo.
      expect(proseMirrorSteps).not.toHaveBeenCalled();
    });
  });

  describe('when an incoming state cannot be applied precisely', () => {
    it('falls back to a coarse replace and reports when a step fails to apply', async () => {
      const { liveDocument, view, onError, proseMirrorSteps } =
        await setUpEditor();
      proseMirrorSteps.mockReturnValue(
        Effect.succeed({
          pmDocAfter: doc([para('from a peer')]),
          // Text straight under the doc node is invalid content.
          steps: [new ReplaceStep(0, 0, textSlice('x'))],
        })
      );

      await Effect.runPromise(liveDocument.change('from a peer'));

      await eventually(() =>
        expect(view.state.doc.textContent).toBe('from a peer')
      );
      expect(onError).toHaveBeenCalledExactlyOnceWith(
        expect.any(LiveSyncFallbackError)
      );
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reason: 'steps-mismatch' },
          // The message names the step that failed, the only one here.
          message: expect.stringContaining('(step 0)'),
        })
      );
    });

    it('falls back to a coarse replace and reports when the final doc mismatches', async () => {
      const { liveDocument, view, onError, proseMirrorSteps } =
        await setUpEditor();
      proseMirrorSteps.mockReturnValue(
        Effect.succeed({ pmDocAfter: doc([para('from a peer')]), steps: [] })
      );

      await Effect.runPromise(liveDocument.change('from a peer'));

      await eventually(() =>
        expect(view.state.doc.textContent).toBe('from a peer')
      );
      expect(onError).toHaveBeenCalledExactlyOnceWith(
        expect.any(LiveSyncFallbackError)
      );
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reason: 'steps-mismatch' },
          message: expect.not.stringContaining('(step'),
        })
      );
    });

    it('falls back to a coarse replace and reports when the steps cannot be computed', async () => {
      const { liveDocument, view, onError, proseMirrorSteps } =
        await setUpEditor({ initialText: 'hello world' });
      proseMirrorSteps.mockReturnValue(
        Effect.fail(new PatchError('Cannot emit steps: table'))
      );

      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 6))
      );

      await Effect.runPromise(liveDocument.change('hello world and more'));

      await eventually(() =>
        expect(view.state.doc.textContent).toBe('hello world and more')
      );
      expect(view.state.selection.head).toBe(6);
      expect(onError).toHaveBeenCalledExactlyOnceWith(
        expect.any(LiveSyncFallbackError)
      );
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reason: 'steps-failed' },
          message: expect.stringContaining('Cannot emit steps: table'),
        })
      );
    });

    it('reports a failed fallback conversion as a transform error and keeps applying later changes', async () => {
      const {
        liveDocument,
        view,
        onError,
        proseMirrorSteps,
        convertToProseMirror,
      } = await setUpEditor();
      // The conversion below only runs as the fallback, when the steps can't be
      // computed.
      proseMirrorSteps.mockReturnValueOnce(
        Effect.fail(new RichTextLibError('steps failed'))
      );
      convertToProseMirror.mockRejectedValueOnce(
        new Error('conversion failed')
      );
      const reportedError = promiseWithResolvers<unknown>();
      onError.mockImplementationOnce(reportedError.resolve);

      await Effect.runPromise(liveDocument.change('breaks'));
      // The plugin only applies the latest state, so 'recovers' published
      // straight away could skip 'breaks'.
      const reported = await reportedError.promise;

      await Effect.runPromise(liveDocument.change('recovers'));
      await eventually(() =>
        expect(view.state.doc.textContent).toBe('recovers')
      );

      expect(reported).toBeInstanceOf(RepresentationTransformError);
      expect((reported as Error).message).toBe('conversion failed');
      // No fallback is reported: the failed conversion left nothing to apply.
      expect(onError).toHaveBeenCalledOnce();
    });

    it('reports an error thrown while applying a change as a web editor error', async () => {
      const { liveDocument, onError, proseMirrorSteps } = await setUpEditor();
      // The steps are computed, but with an unusable target doc, so applying
      // them to the view throws.
      proseMirrorSteps.mockReturnValue(
        Effect.succeed({ pmDocAfter: null as unknown as PMNode, steps: [] })
      );

      await Effect.runPromise(liveDocument.change('anything'));

      await eventually(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(onError.mock.calls[0][0]).toBeInstanceOf(WebEditorError);
    });
  });

  describe('the sync state it exposes', () => {
    it('starts at the initial version with no local edits pending', async () => {
      const { view } = await setUpEditor();

      expect(getLiveSyncState(view.state)).toEqual({
        baseVersion: 'v0',
        hasPendingLocalEdits: false,
      });
    });

    it('has a local edit pending until its version comes back', async () => {
      const { liveDocument, view, onChange } = await setUpEditor();
      // Like the real document, publishes the new state before resolving with
      // its version.
      const contribution = promiseWithResolvers<ConvergentDocumentVersion>();
      onChange.mockImplementationOnce((doc) =>
        pipe(
          Effect.promise(() => contribution.promise),
          Effect.tap((version) =>
            SubscriptionRef.set(liveDocument.content, {
              doc: markdownDocument(textOf(doc)),
              version,
            })
          )
        )
      );

      view.dispatch(view.state.tr.insertText('!', 6));
      expect(getLiveSyncState(view.state)).toEqual({
        baseVersion: 'v0',
        hasPendingLocalEdits: true,
      });

      contribution.resolve('v1');
      await eventually(() =>
        expect(getLiveSyncState(view.state)).toEqual({
          baseVersion: 'v1',
          hasPendingLocalEdits: false,
        })
      );
    });

    it('shows the version of an incoming state once applied', async () => {
      const { liveDocument, view } = await setUpEditor();

      const version = await Effect.runPromise(
        liveDocument.change('hello from a peer')
      );

      await eventually(() =>
        expect(getLiveSyncState(view.state).baseVersion).toBe(version)
      );
    });

    it('has no local edit pending after a selection change', async () => {
      const { view } = await setUpEditor();

      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 3))
      );

      expect(getLiveSyncState(view.state).hasPendingLocalEdits).toBe(false);
    });
  });
});
