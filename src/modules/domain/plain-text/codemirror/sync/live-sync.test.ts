import { history, undo } from '@codemirror/commands';
import { EditorSelection, EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  promiseWithResolvers,
  useFakeTimersInTest,
} from '../../../../../utils/test-utils';
import {
  type ConvergentDocumentVersion,
  type RemotePresence,
} from '../../../collaboration';
import {
  type ParticipantSelection,
  type PlainTextDocument,
  plainTextDocument,
} from '../../models';
import {
  type PlainTextConvergentDocument,
  type PlainTextConvergentDocumentState,
} from '../../ports';
import { getLiveSyncState, liveSync, type LiveSyncArgs } from './live-sync';

// The binding syncs in the background, where the test can't await it;
// `eventually` polls its assertions until they hold.
const eventually = (assertions: () => void | Promise<void>) =>
  vi.waitFor(assertions);

// A convergent document holding text in memory, versioned by a counter. The
// editor only needs a document that publishes and versions what it is given;
// convergence itself is the real convergent document's concern.
const createConvergentDocumentInMemory = (
  initialText: string
): Promise<PlainTextConvergentDocument> =>
  Effect.runPromise(
    pipe(
      Effect.all({
        content: SubscriptionRef.make<PlainTextConvergentDocumentState>({
          doc: plainTextDocument(initialText),
          version: 'v0',
        }),
        peers: SubscriptionRef.make<
          ReadonlyArray<RemotePresence<ParticipantSelection>>
        >([]),
      }),
      Effect.map(({ content, peers }) => {
        let versions = 0;

        const change = ({ content: text }: PlainTextDocument) =>
          pipe(
            SubscriptionRef.get(content),
            Effect.flatMap((previous) =>
              // Publishing equal text would look like a change to the editor,
              // so it has to short-circuit before the set.
              previous.doc.content === text
                ? Effect.succeed(previous.version)
                : SubscriptionRef.modify(content, () => {
                    versions += 1;
                    const version = `v${versions}`;

                    // [effect result, new state].
                    return [version, { doc: plainTextDocument(text), version }];
                  })
            )
          );

        return {
          content,
          change,
          presence: { peers, publish: () => Effect.void },
          errors: Stream.empty,
          close: Effect.void,
        };
      })
    )
  );

const setUpEditor = async ({
  initialText = 'hello',
}: { initialText?: string } = {}) => {
  const liveDocument = await createConvergentDocumentInMemory(initialText);
  const initial = await Effect.runPromise(
    SubscriptionRef.get(liveDocument.content)
  );

  const onChange = vi.fn<LiveSyncArgs['onChange']>((doc, options) =>
    liveDocument.change(doc, options)
  );
  const onError = vi.fn<LiveSyncArgs['onError']>();

  const dispatchTransactions = vi.fn(
    (transactions: readonly Transaction[], editorView: EditorView) => {
      editorView.update(transactions);
    }
  );
  const view = new EditorView({
    state: EditorState.create({
      doc: initialText,
      extensions: [
        history(),
        liveSync({
          content: liveDocument.content,
          onChange,
          initialVersion: initial.version,
          onError,
        }),
      ],
    }),
    dispatchTransactions,
  });
  onTestFinished(() => {
    view.destroy();
  });

  // The binding also dispatches to record versions; only edits touch the text.
  const edits = () =>
    dispatchTransactions.mock.calls
      .flatMap(([transactions]) => transactions)
      .filter((tr) => tr.docChanged);

  const type = ({ text, at }: { text: string; at: number }) =>
    view.dispatch({
      changes: { from: at, insert: text },
      userEvent: 'input.type',
    });

  return { liveDocument, view, onChange, onError, edits, type };
};

const textOf = (view: EditorView) => view.state.doc.toString();

describe('liveSync', () => {
  describe('local edits', () => {
    it("contributes the editor's text to the live document", async () => {
      const { liveDocument, view, type } = await setUpEditor();

      type({ text: ' world', at: 5 });

      await eventually(async () => {
        const current = await Effect.runPromise(
          SubscriptionRef.get(liveDocument.content)
        );
        expect(current.doc.content).toBe('hello world');
      });
      expect(textOf(view)).toBe('hello world');
    });

    it('anchors local edits at the version shown in the editor', async () => {
      const { liveDocument, view, onChange, type } = await setUpEditor();

      type({ text: ' world', at: 5 });

      await eventually(() => expect(onChange).toHaveBeenCalledTimes(1));
      expect(onChange).toHaveBeenLastCalledWith(expect.anything(), {
        base: 'v0',
      });

      const peerVersion = await Effect.runPromise(
        liveDocument.change(plainTextDocument('from a peer'))
      );
      await eventually(() => expect(textOf(view)).toBe('from a peer'));

      type({ text: '!', at: 11 });

      await eventually(() => expect(onChange).toHaveBeenCalledTimes(2));
      expect(onChange).toHaveBeenLastCalledWith(expect.anything(), {
        base: peerVersion,
      });
    });

    it('marks local edits as pending until their contribution resolves', async () => {
      const { liveDocument, view, onChange, type } = await setUpEditor();
      useFakeTimersInTest();
      // The document publishes the contribution before it resolves.
      const contribution = promiseWithResolvers<ConvergentDocumentVersion>();
      onChange.mockImplementationOnce(() =>
        pipe(
          SubscriptionRef.set(liveDocument.content, {
            doc: plainTextDocument('hello!'),
            version: 'v1',
          }),
          Effect.zipRight(Effect.promise(() => contribution.promise))
        )
      );

      type({ text: '!', at: 5 });

      expect(getLiveSyncState(view.state)).toEqual({
        baseVersion: 'v0',
        hasPendingLocalEdits: true,
      });

      contribution.resolve('v1');
      await vi.runAllTimersAsync();

      expect(getLiveSyncState(view.state)).toEqual({
        baseVersion: 'v1',
        hasPendingLocalEdits: false,
      });
    });
  });

  describe('incoming states', () => {
    it("applies a peer's change only where the text differs, kept out of the undo history", async () => {
      const { liveDocument, view, edits } = await setUpEditor({
        initialText: 'hello world',
      });

      await Effect.runPromise(
        liveDocument.change(plainTextDocument('hello big world'))
      );

      await eventually(() => expect(textOf(view)).toBe('hello big world'));
      const transactions = edits();
      expect(transactions).toHaveLength(1);
      expect(transactions[0].annotation(Transaction.addToHistory)).toBe(false);
      const changed: Array<{ from: number; to: number; inserted: string }> = [];
      transactions[0].changes.iterChanges((from, to, _fromB, _toB, inserted) =>
        changed.push({ from, to, inserted: inserted.toString() })
      );
      expect(changed).toEqual([{ from: 6, to: 6, inserted: 'big ' }]);
    });

    it('does not contribute an incoming state back to the document', async () => {
      const { liveDocument, view, onChange } = await setUpEditor();

      await Effect.runPromise(
        liveDocument.change(plainTextDocument('from a peer'))
      );

      await eventually(() => expect(textOf(view)).toBe('from a peer'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps the caret in place when a change is made elsewhere in the text', async () => {
      const { liveDocument, view } = await setUpEditor({
        initialText: 'hello world',
      });
      view.dispatch({ selection: EditorSelection.cursor(5) });

      await Effect.runPromise(
        liveDocument.change(plainTextDocument('hello world and more'))
      );

      await eventually(() => expect(textOf(view)).toBe('hello world and more'));
      expect(view.state.selection.main.head).toBe(5);
    });

    it("keeps the caret between a peer's edits on both sides of it", async () => {
      const { liveDocument, view } = await setUpEditor({
        initialText: 'hello world',
      });
      // Between "hello" and " world".
      view.dispatch({ selection: EditorSelection.cursor(5) });

      await Effect.runPromise(
        liveDocument.change(plainTextDocument('oh hello world!'))
      );

      await eventually(() => expect(textOf(view)).toBe('oh hello world!'));
      // Still between "hello" and " world", after the 3 characters before it.
      expect(view.state.selection.main.head).toBe(8);
    });

    it("undoes the user's own last edit, not a peer's change after it", async () => {
      const { liveDocument, view, onChange, type } = await setUpEditor();

      type({ text: '!', at: 5 });
      await eventually(() => expect(onChange).toHaveBeenCalledTimes(1));
      await Effect.runPromise(
        liveDocument.change(plainTextDocument('from a peer: hello!'))
      );
      await eventually(() => expect(textOf(view)).toBe('from a peer: hello!'));

      undo(view);

      expect(textOf(view)).toBe('from a peer: hello');
    });

    it('adopts the version of a state the editor already shows without editing', async () => {
      const { liveDocument, view, edits } = await setUpEditor();

      await Effect.runPromise(
        SubscriptionRef.set(liveDocument.content, {
          doc: plainTextDocument('hello'),
          version: 'r1',
        })
      );

      await eventually(() =>
        expect(getLiveSyncState(view.state).baseVersion).toBe('r1')
      );
      expect(edits()).toHaveLength(0);
    });
  });

  describe('contributions in flight and their echoes', () => {
    it('holds incoming states while an own contribution is in flight', async () => {
      const { liveDocument, view, onChange, type } = await setUpEditor();
      useFakeTimersInTest();
      const firstVersion = promiseWithResolvers<ConvergentDocumentVersion>();
      const secondVersion = promiseWithResolvers<ConvergentDocumentVersion>();
      onChange
        .mockReturnValueOnce(Effect.promise(() => firstVersion.promise))
        .mockReturnValueOnce(Effect.promise(() => secondVersion.promise));

      type({ text: '!', at: 5 });
      type({ text: '?', at: 6 });

      await Effect.runPromise(
        SubscriptionRef.set(liveDocument.content, {
          doc: plainTextDocument('from a peer'),
          version: 'r1',
        })
      );
      await vi.runAllTimersAsync();

      expect(textOf(view)).toBe('hello!?');

      // One contribution resolved, the other still on its way: still held.
      firstVersion.resolve('v1');
      await vi.runAllTimersAsync();

      expect(textOf(view)).toBe('hello!?');

      secondVersion.resolve('v2');
      await Effect.runPromise(
        SubscriptionRef.set(liveDocument.content, {
          doc: plainTextDocument('hello!? from a peer'),
          version: 'r2',
        })
      );

      await eventually(() => expect(textOf(view)).toBe('hello!? from a peer'));
    });

    it('applies a state that arrived during a contribution once the contribution resolves', async () => {
      const { liveDocument, view, onChange, type } = await setUpEditor();
      useFakeTimersInTest();
      const contribution = promiseWithResolvers<ConvergentDocumentVersion>();
      onChange.mockReturnValueOnce(Effect.promise(() => contribution.promise));

      type({ text: '!', at: 5 });
      // A peer's edit, merged with the '!' that reached the document.
      await Effect.runPromise(
        SubscriptionRef.set(liveDocument.content, {
          doc: plainTextDocument('hello! from a peer'),
          version: 'r1',
        })
      );
      await vi.runAllTimersAsync();
      expect(textOf(view)).toBe('hello!');

      contribution.resolve('v1');

      await eventually(() => expect(textOf(view)).toBe('hello! from a peer'));
    });

    // Typing comes back as a new state of the document: its echo. By the time
    // it arrives the user may have typed more, so it is an older state than
    // the editor shows, and only its version tells it is the editor's own.
    it('does not wipe a keystroke made while the echo of an earlier one arrives', async () => {
      const { liveDocument, view, onChange, edits, type } = await setUpEditor();
      useFakeTimersInTest();

      // Typing '!' contributes 'hello!', which the document publishes back
      // straight away; its version reaches the editor only when the test
      // resolves it.
      const echoVersion = promiseWithResolvers<ConvergentDocumentVersion>();
      onChange.mockImplementationOnce(() =>
        pipe(
          SubscriptionRef.set(liveDocument.content, {
            doc: plainTextDocument('hello!'),
            version: 'v1',
          }),
          Effect.zipRight(Effect.promise(() => echoVersion.promise))
        )
      );
      type({ text: '!', at: 5 });
      await vi.runAllTimersAsync();

      type({ text: '?', at: 6 });
      const editsAfterTyping = edits().length;

      echoVersion.resolve('v1');
      await vi.runAllTimersAsync();

      expect(textOf(view)).toBe('hello!?');
      expect(edits()).toHaveLength(editsAfterTyping);
      const current = await Effect.runPromise(
        SubscriptionRef.get(liveDocument.content)
      );
      expect(current.doc.content).toBe('hello!?');
    });

    it('reports a contribution that failed and keeps syncing', async () => {
      const { liveDocument, view, onChange, onError, type } =
        await setUpEditor();
      const failure = new Error('could not contribute');
      onChange.mockReturnValueOnce(Effect.die(failure));

      type({ text: '!', at: 5 });

      await eventually(() => expect(onError).toHaveBeenCalledOnce());
      await Effect.runPromise(
        liveDocument.change(plainTextDocument('from a peer'))
      );
      await eventually(() => expect(textOf(view)).toBe('from a peer'));
    });
  });
});
