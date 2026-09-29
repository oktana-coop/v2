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
  it('sends local edits to the live document', async () => {
    const { liveDocument, view } = await setUpEditor();

    view.dispatch(view.state.tr.insertText(' world', 6));

    await eventually(async () => {
      const current = await Effect.runPromise(
        SubscriptionRef.get(liveDocument.content)
      );
      // What reaches the document is the primary text representation,
      // whatever the editor contributed.
      expect(current.doc.representation).toBe(PRIMARY_RICH_TEXT_REPRESENTATION);
      expect(current.doc.content).toBe('hello world');
    });
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

  it('does not wipe a keystroke made while an incoming state was converting', async () => {
    const { liveDocument, view, dispatched, proseMirrorSteps } =
      await setUpEditor();

    useFakeTimersInTest();

    const incomingSteps = promiseWithResolvers<ProseMirrorStepsResult>();
    proseMirrorSteps.mockReturnValueOnce(
      Effect.promise(() => incomingSteps.promise)
    );

    await Effect.runPromise(liveDocument.change('from elsewhere'));
    await vi.waitFor(() => expect(proseMirrorSteps).toHaveBeenCalledOnce());
    // The incoming state's steps are still being computed when a keystroke
    // comes in.
    view.dispatch(view.state.tr.insertText('!', 6));
    const editsAfterTyping = editsIn(dispatched()).length;

    // They arrive computed against the doc from before the keystroke.
    incomingSteps.resolve(
      stepsBetween({
        pmDocBefore: doc([para('hello')]),
        pmDocAfter: doc([para('from elsewhere')]),
      })
    );
    await vi.runAllTimersAsync();

    // The lagging state is dropped, never applied-then-healed: the editor
    // must not edit at all, and the keystroke must survive throughout.
    expect(view.state.doc.textContent).toContain('!');
    expect(editsIn(dispatched())).toHaveLength(editsAfterTyping);
  });

  it('holds incoming changes while an own contribution is in flight', async () => {
    const { liveDocument, view, onChange } = await setUpEditor();
    useFakeTimersInTest();
    const contribution = promiseWithResolvers<ConvergentDocumentVersion>();
    onChange.mockReturnValueOnce(Effect.promise(() => contribution.promise));

    view.dispatch(view.state.tr.insertText('!', 6));

    await Effect.runPromise(
      SubscriptionRef.set(liveDocument.content, {
        doc: markdownDocument('from a peer'),
        version: 'r1',
      })
    );
    await vi.runAllTimersAsync();

    expect(view.state.doc.textContent).toBe('hello!');

    contribution.resolve('v1');
    await Effect.runPromise(
      SubscriptionRef.set(liveDocument.content, {
        doc: markdownDocument('hello! from a peer'),
        version: 'r2',
      })
    );

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('hello! from a peer')
    );
  });

  // A contribution comes back as a new state of the document: its echo, in
  // primary text. Converted back, it need not equal what the editor shows,
  // so only its version identifies it. Applying it would replace the
  // document under the caret with a round-tripped copy of itself.
  it('recognizes its own echo by version instead of applying it', async () => {
    const { liveDocument, view, dispatched, onChange } = await setUpEditor();
    useFakeTimersInTest();
    // Publishes before resolving, as the port contract requires; the echo's
    // content round-trips differently than the editor's doc.
    onChange.mockImplementationOnce((doc) =>
      pipe(
        SubscriptionRef.set(liveDocument.content, {
          doc: markdownDocument(`${textOf(doc)} (round-tripped)`),
          version: 'v1',
        }),
        Effect.as('v1')
      )
    );

    view.dispatch(view.state.tr.insertText('!', 6));
    const typed = view.state.doc.textContent;
    const editsAfterTyping = editsIn(dispatched()).length;

    // Give the echo its chance to arrive, then assert it changed nothing.
    await vi.runAllTimersAsync();

    expect(view.state.doc.textContent).toBe(typed);
    expect(editsIn(dispatched())).toHaveLength(editsAfterTyping);
  });

  // The echo is published before the contribution resolves with its version,
  // so telling the two apart means waiting for the version, not converting.
  it('does not compute steps for its own echo', async () => {
    const { view, proseMirrorSteps } = await setUpEditor();
    useFakeTimersInTest();

    view.dispatch(view.state.tr.insertText('!', 6));

    // Give the echo its chance to arrive.
    await vi.runAllTimersAsync();

    expect(proseMirrorSteps).not.toHaveBeenCalled();
  });

  it('applies a state that arrived during a contribution once the contribution resolves', async () => {
    const { liveDocument, view, onChange } = await setUpEditor();
    useFakeTimersInTest();
    // Resolves with the version it was anchored at and publishes nothing, as
    // a contribution that changes nothing does.
    const contribution = promiseWithResolvers<ConvergentDocumentVersion>();
    onChange.mockReturnValueOnce(Effect.promise(() => contribution.promise));

    view.dispatch(view.state.tr.insertText('!', 6));
    await Effect.runPromise(
      SubscriptionRef.set(liveDocument.content, {
        doc: markdownDocument('from a peer'),
        version: 'r1',
      })
    );
    await vi.runAllTimersAsync();
    expect(view.state.doc.textContent).toBe('hello!');

    contribution.resolve('v0');

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from a peer')
    );
  });

  it('anchors local edits at the version shown in the editor', async () => {
    const { liveDocument, view, onChange } = await setUpEditor();

    view.dispatch(view.state.tr.insertText(' world', 6));

    await eventually(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), {
      base: 'v0',
    });

    await Effect.runPromise(liveDocument.change('from elsewhere'));
    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from elsewhere')
    );

    view.dispatch(view.state.tr.insertText('!', 1));

    await eventually(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), {
      base: 'v2',
    });
  });

  it('applies an external change as a transaction on the same view', async () => {
    const { liveDocument, view, dispatched } = await setUpEditor();
    const domBefore = view.dom;

    await Effect.runPromise(liveDocument.change('from elsewhere'));

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from elsewhere')
    );
    expect(view.dom).toBe(domBefore);
    const transactions = dispatched();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].getMeta('addToHistory')).toBe(false);
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

  it('reports a failed conversion as a transform error and keeps applying later changes', async () => {
    const {
      liveDocument,
      view,
      onError,
      proseMirrorSteps,
      convertToProseMirror,
    } = await setUpEditor();
    // Failing to compute the steps is a fallback; the change is lost only when
    // the plain conversion fails too, and then nothing was applied to
    // report a fallback for.
    proseMirrorSteps.mockReturnValueOnce(
      Effect.fail(new RichTextLibError('no wasm'))
    );
    convertToProseMirror.mockRejectedValueOnce(new Error('conversion failed'));

    await Effect.runPromise(liveDocument.change('breaks'));
    // Wait for the failing change to be handled before issuing the next, so
    // it isn't conflated away.
    await eventually(() => expect(onError).toHaveBeenCalledTimes(1));

    await Effect.runPromise(liveDocument.change('recovers'));
    await eventually(() => expect(view.state.doc.textContent).toBe('recovers'));

    // The failure surfaced as a typed transform error carrying the original
    // message, and the next change was still applied — one bad conversion
    // doesn't stop syncing.
    const reported = onError.mock.calls[0][0];
    expect(reported).toBeInstanceOf(RepresentationTransformError);
    expect((reported as Error).message).toBe('conversion failed');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports an error thrown while applying a change as a web editor error', async () => {
    const { liveDocument, onError, proseMirrorSteps } = await setUpEditor();
    // A conversion that yields an unusable value throws while the change is
    // applied to the view. That's a different stage from converting, and the
    // failure is still reported.
    proseMirrorSteps.mockReturnValue(
      Effect.succeed({ pmDocAfter: null as unknown as PMNode, steps: [] })
    );

    await Effect.runPromise(liveDocument.change('anything'));

    await eventually(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(WebEditorError);
  });

  it('takes a ProseMirror-representation state through the steps path too', async () => {
    const { liveDocument, view, proseMirrorSteps } = await setUpEditor();

    await Effect.runPromise(
      SubscriptionRef.set(liveDocument.content, {
        doc: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: richTextRepresentations.PROSEMIRROR,
          content: JSON.stringify(doc([para('from elsewhere')]).toJSON()),
        },
        version: 'pm',
      })
    );

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from elsewhere')
    );
    expect(proseMirrorSteps).toHaveBeenCalledTimes(1);
    expect(proseMirrorSteps.mock.calls[0][0].docAfter.representation).toBe(
      richTextRepresentations.PROSEMIRROR
    );
  });

  it('applies steps as a single transaction and keeps the caret when two remote regions bracket it', async () => {
    const { liveDocument, view, dispatched, onError, proseMirrorSteps } =
      await setUpEditor({ initialText: 'hello world' });
    // A single region replace would span both edits and drag the caret
    // between them to its end.
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

  it('falls back to the region replace and reports when a step fails to apply', async () => {
    const { liveDocument, view, onError, proseMirrorSteps } =
      await setUpEditor();
    proseMirrorSteps.mockReturnValue(
      Effect.succeed({
        pmDocAfter: doc([para('from elsewhere')]),
        // Text straight under the doc node is invalid content.
        steps: [new ReplaceStep(0, 0, textSlice('x'))],
      })
    );

    await Effect.runPromise(liveDocument.change('from elsewhere'));

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from elsewhere')
    );
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      expect.any(LiveSyncFallbackError)
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reason: 'steps-mismatch' },
        message: expect.stringContaining('(step 0)'),
      })
    );
  });

  it('falls back when the final doc mismatches', async () => {
    const { liveDocument, view, onError, proseMirrorSteps } =
      await setUpEditor();
    proseMirrorSteps.mockReturnValue(
      Effect.succeed({ pmDocAfter: doc([para('from elsewhere')]), steps: [] })
    );

    await Effect.runPromise(liveDocument.change('from elsewhere'));

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from elsewhere')
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

  it('falls back to the converted doc and reports when the steps cannot be computed', async () => {
    const { liveDocument, view, onError, proseMirrorSteps } = await setUpEditor(
      { initialText: 'hello world' }
    );
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

  describe('what it shows of the live document', () => {
    it('starts at the initial version with no local edits pending', async () => {
      const { view } = await setUpEditor();

      expect(getLiveSyncState(view.state)).toEqual({
        baseVersion: 'v0',
        hasPendingLocalEdits: false,
      });
    });

    it('has a local edit pending until its version comes back', async () => {
      const { liveDocument, view, onChange } = await setUpEditor();
      // Publishes before resolving, as the port contract requires.
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
