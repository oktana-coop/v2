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
import { ReplaceStep, replaceStep, type Step } from 'prosemirror-transform';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  LiveSyncFallbackError,
  type LiveSyncFallbackReason,
  PatchError,
  RepresentationTransformError,
  RichTextLibError,
  WebEditorError,
} from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RemotePresence,
  type RichTextDocument,
  richTextRepresentations,
} from '../../models';
import {
  type ConvergentDocument,
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentState,
} from '../../ports/convergent-document';
import { pmDocFromJSONString } from '../json';
import { schema } from '../schema';
import { textSlice } from '../test-utils';
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

const markdownDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.MARKDOWN,
  content,
});

const paragraph = (text: string): PMNode =>
  schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text(text)]),
  ]);

// The editor contributes its own representation; everything else is already
// the primary text one.
const textOf = (doc: RichTextDocument) =>
  doc.representation === richTextRepresentations.PROSEMIRROR
    ? pmDocFromJSONString(JSON.parse(doc.content), schema).textContent
    : doc.content;

type ProseMirrorSteps = LiveSyncPluginArgs['proseMirrorSteps'];

// Stands in for hs-lib: the incoming doc plus one exact step to it, which
// keeps a caret outside the changed region where it is.
const stepsBetween = ({
  docBefore,
  docAfter,
}: {
  docBefore: PMNode;
  docAfter: PMNode;
}): Step[] => {
  const start = docBefore.content.findDiffStart(docAfter.content);
  const end = docBefore.content.findDiffEnd(docAfter.content);
  if (start === null || end === null) return [];

  const overlap = Math.max(0, start - Math.min(end.a, end.b));
  const step = replaceStep(
    docBefore,
    start,
    end.a + overlap,
    docAfter.slice(start, end.b + overlap)
  );

  return step ? [step] : [];
};

// Asynchronous like the real adapter, so the checks after the await see
// the same interleavings.
const stepsTo: ProseMirrorSteps = ({ pmDocBefore, docAfter }) =>
  Effect.promise(async () => {
    const pmDocAfter = paragraph(textOf(docAfter));

    return {
      pmDocAfter,
      steps: stepsBetween({ docBefore: pmDocBefore, docAfter: pmDocAfter }),
    };
  });

// The one fallback the plugin reported, checked for its reason; its
// message is returned for the test to look into.
const reportedFallbackMessage = ({
  onError,
  reason,
}: {
  onError: Mock;
  reason: LiveSyncFallbackReason;
}): string => {
  expect(onError).toHaveBeenCalledTimes(1);
  const reported = onError.mock.calls[0][0];
  expect(reported).toBeInstanceOf(LiveSyncFallbackError);
  expect((reported as LiveSyncFallbackError).data.reason).toBe(reason);
  return (reported as LiveSyncFallbackError).message;
};

// Sync lands on plugin-internal fibers the test can't await, so state is
// reached asynchronously; `eventually` polls its assertions until they hold.
const eventually = (assertions: () => void | Promise<void>) =>
  vi.waitFor(assertions);

// A convergent document holding text in memory, versioned by a counter. The
// editor only needs a document that publishes and versions what it is given;
// convergence itself is the real adapter's business.
const createConvergentDocumentInMemory = (
  initialText: string
): Promise<ConvergentDocument> =>
  Effect.runPromise(
    pipe(
      Effect.all({
        content: SubscriptionRef.make<ConvergentDocumentState>({
          doc: markdownDocument(initialText),
          version: '0',
        }),
        presence: noPresence,
      }),
      Effect.map(({ content, presence }) => {
        const change = (text: string) =>
          pipe(
            SubscriptionRef.get(content),
            Effect.flatMap((previous) =>
              // Publishing equal content would look like a change to the
              // editor, so it has to short-circuit before the set.
              previous.doc.content === text
                ? Effect.succeed(previous.version)
                : SubscriptionRef.modify(content, (current) => {
                    const version = String(Number(current.version) + 1);

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

const views: EditorView[] = [];

// The plugin also dispatches to record versions; only edits touch the doc.
const editsIn = (transactions: Transaction[]) =>
  transactions.filter((tr) => tr.docChanged);

const setup = async ({
  initialText = 'hello',
  proseMirrorSteps = stepsTo,
  convertToProseMirror = async (doc: RichTextDocument) =>
    paragraph(textOf(doc)),
  createConvergentDocument = (text: string) =>
    createConvergentDocumentInMemory(text),
}: {
  initialText?: string;
  proseMirrorSteps?: ProseMirrorSteps;
  convertToProseMirror?: (doc: RichTextDocument) => Promise<PMNode>;
  createConvergentDocument?: (text: string) => Promise<ConvergentDocument>;
} = {}) => {
  const liveDocument = await createConvergentDocument(initialText);
  const initial = await Effect.runPromise(
    SubscriptionRef.get(liveDocument.content)
  );
  const onError = vi.fn();
  const dispatched: Transaction[] = [];

  // Records what the plugin contributes, so tests can assert on the options.
  const changeCalls: Array<{
    doc: RichTextDocument;
    options: ConvergentDocumentChangeOptions | undefined;
  }> = [];

  // Stands in for what the command does around the document: contributions
  // arrive in the editor's representation and reach it as primary text.
  const change = (
    doc: RichTextDocument,
    options?: ConvergentDocumentChangeOptions
  ) => {
    changeCalls.push({ doc, options });

    return liveDocument.change(textOf(doc), options);
  };

  const state = EditorState.create({
    schema,
    doc: paragraph(initialText),
    plugins: [
      liveSyncPlugin({
        content: liveDocument.content,
        onChange: change,
        initialVersion: initial.version,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        schema,
        proseMirrorSteps,
        convertToProseMirror,
        onError,
      }),
    ],
  });

  const view: EditorView = new EditorView(document.createElement('div'), {
    state,
    dispatchTransaction: (tr) => {
      dispatched.push(tr);
      view.updateState(view.state.apply(tr));
    },
  });
  views.push(view);

  return { liveDocument, view, dispatched, onError, changeCalls };
};

describe('liveSyncPlugin', () => {
  afterEach(() => {
    views.splice(0).forEach((view) => view.destroy());
  });

  it('sends local edits to the live document', async () => {
    const { liveDocument, view } = await setup();

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

  // Echoes come back as primary text, as the automerge adapter publishes
  // them; converted, they need not equal the editor's doc — the version is
  // what identifies them. Applying one would replace the document under the
  // user's cursor with its own round-tripped shadow.
  it('keeps the caret in place when a change lands elsewhere', async () => {
    const { liveDocument, view } = await setup({ initialText: 'hello world' });

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
    const { liveDocument, view, dispatched } = await setup({
      proseMirrorSteps: (args) => Effect.delay(stepsTo(args), '40 millis'),
    });

    await Effect.runPromise(liveDocument.change('from elsewhere'));
    // The incoming state is converting; a keystroke lands meanwhile.
    await new Promise((resolve) => setTimeout(resolve, 10));
    view.dispatch(view.state.tr.insertText('!', 6));
    const editsAfterTyping = editsIn(dispatched).length;

    // The lagging state is dropped, never applied-then-healed: the editor
    // must not edit at all, and the keystroke must survive throughout.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(view.state.doc.textContent).toContain('!');
    expect(editsIn(dispatched)).toHaveLength(editsAfterTyping);
  });

  it('holds incoming changes while an own contribution is in flight', async () => {
    let resolveContribution: (() => void) | undefined;
    const content = await Effect.runPromise(
      SubscriptionRef.make<ConvergentDocumentState>({
        doc: markdownDocument('hello'),
        version: '0',
      })
    );
    const liveDocument: ConvergentDocument = {
      content,
      change: () =>
        Effect.promise(
          () =>
            new Promise<string>((resolve) => {
              resolveContribution = () => resolve('1');
            })
        ),
      presence: await Effect.runPromise(noPresence),
      errors: Stream.empty,
      close: Effect.void,
    };

    const { view } = await setup({
      createConvergentDocument: () => Promise.resolve(liveDocument),
    });

    view.dispatch(view.state.tr.insertText('!', 6));

    await Effect.runPromise(
      SubscriptionRef.set(content, {
        doc: markdownDocument('from a peer'),
        version: 'r1',
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(view.state.doc.textContent).toBe('hello!');

    resolveContribution?.();
    await Effect.runPromise(
      SubscriptionRef.set(content, {
        doc: markdownDocument('hello! from a peer'),
        version: 'r2',
      })
    );

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('hello! from a peer')
    );
  });

  it('recognizes its own echo by version instead of applying it', async () => {
    const content = await Effect.runPromise(
      SubscriptionRef.make<ConvergentDocumentState>({
        doc: markdownDocument('hello'),
        version: '0',
      })
    );
    let versions = 0;
    const echoing: ConvergentDocument = {
      content,
      change: (text) => {
        versions += 1;
        const version = String(versions);

        // Publishes before resolving, as the port contract requires; the
        // echo's content round-trips differently than the editor's doc.
        return pipe(
          SubscriptionRef.set(content, {
            doc: markdownDocument(`${text} (round-tripped)`),
            version,
          }),
          Effect.as(version)
        );
      },
      presence: await Effect.runPromise(noPresence),
      errors: Stream.empty,
      close: Effect.void,
    };

    const { view, dispatched } = await setup({
      createConvergentDocument: () => Promise.resolve(echoing),
    });

    view.dispatch(view.state.tr.insertText('!', 6));
    const typed = view.state.doc.textContent;
    const editsAfterTyping = editsIn(dispatched).length;

    // Give the echo its chance to arrive, then assert it changed nothing.
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(view.state.doc.textContent).toBe(typed);
    expect(editsIn(dispatched)).toHaveLength(editsAfterTyping);
  });

  // The echo is published before the contribution resolves with its version,
  // so telling the two apart means waiting for the version, not converting.
  it('does not compute steps for its own echo', async () => {
    const proseMirrorSteps = vi.fn(stepsTo);
    const { view } = await setup({ proseMirrorSteps });

    view.dispatch(view.state.tr.insertText('!', 6));

    // Give the echo its chance to arrive.
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(proseMirrorSteps).not.toHaveBeenCalled();
  });

  it('applies a state that arrived during a contribution once the contribution resolves', async () => {
    let resolveContribution: (() => void) | undefined;
    const content = await Effect.runPromise(
      SubscriptionRef.make<ConvergentDocumentState>({
        doc: markdownDocument('hello'),
        version: '0',
      })
    );
    const liveDocument: ConvergentDocument = {
      content,
      // Resolves with the version it was anchored at and publishes nothing,
      // as a contribution that changes nothing does.
      change: () =>
        Effect.promise(
          () =>
            new Promise<string>((resolve) => {
              resolveContribution = () => resolve('0');
            })
        ),
      presence: await Effect.runPromise(noPresence),
      errors: Stream.empty,
      close: Effect.void,
    };

    const { view } = await setup({
      createConvergentDocument: () => Promise.resolve(liveDocument),
    });

    view.dispatch(view.state.tr.insertText('!', 6));
    await Effect.runPromise(
      SubscriptionRef.set(content, {
        doc: markdownDocument('from a peer'),
        version: 'r1',
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(view.state.doc.textContent).toBe('hello!');

    resolveContribution?.();

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from a peer')
    );
  });

  it('anchors local edits at the version shown in the editor', async () => {
    const { liveDocument, view, changeCalls } = await setup();

    view.dispatch(view.state.tr.insertText(' world', 6));

    await eventually(() => expect(changeCalls).toHaveLength(1));
    expect(changeCalls[0].options).toEqual({ base: '0' });

    await Effect.runPromise(liveDocument.change('from elsewhere'));
    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from elsewhere')
    );

    view.dispatch(view.state.tr.insertText('!', 1));

    await eventually(() => expect(changeCalls).toHaveLength(2));
    expect(changeCalls[1].options).toEqual({ base: '2' });
  });

  it('applies an external change as a transaction on the same view', async () => {
    const { liveDocument, view, dispatched } = await setup();
    const domBefore = view.dom;

    await Effect.runPromise(liveDocument.change('from elsewhere'));

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from elsewhere')
    );
    expect(view.dom).toBe(domBefore);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].getMeta('addToHistory')).toBe(false);
  });

  it('collapses changes that arrive faster than they can be applied', async () => {
    // A slow conversion lets several changes queue up while the first is still
    // being applied.
    const { liveDocument, view, dispatched } = await setup({
      proseMirrorSteps: (args) => Effect.delay(stepsTo(args), '40 millis'),
    });

    for (const text of ['first', 'second', 'third', 'latest']) {
      await Effect.runPromise(liveDocument.change(text));
    }

    // Wait until the editor converges to the newest change. Once it does, the
    // remaining wake-ups are version-guarded no-ops, so the dispatch count is
    // final: the intermediates were skipped, never one transaction per change
    // (which is what no conflation would produce).
    await eventually(() => expect(view.state.doc.textContent).toBe('latest'));
    expect(dispatched.length).toBeLessThanOrEqual(2);
  });

  it('reports a failed conversion as a transform error and keeps applying later changes', async () => {
    // hs-lib failing the steps is a fallback; the change is lost only when
    // the plain conversion fails too, and then nothing was applied to
    // report a fallback for.
    let call = 0;
    const { liveDocument, view, onError } = await setup({
      proseMirrorSteps: (args) =>
        call === 0
          ? Effect.fail(new RichTextLibError('no wasm'))
          : stepsTo(args),
      convertToProseMirror: async (doc) => {
        call += 1;
        if (call === 1) throw new Error('conversion failed');
        return paragraph(doc.content);
      },
    });

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
    // A conversion that yields an unusable value throws when the change is
    // applied to the view — the web-coupled apply stage, distinct from the
    // transform, and the path that used to escape as an unhandled defect.
    const { liveDocument, onError } = await setup({
      proseMirrorSteps: () =>
        Effect.succeed({ pmDocAfter: null as unknown as PMNode, steps: [] }),
    });

    await Effect.runPromise(liveDocument.change('anything'));

    await eventually(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(WebEditorError);
  });

  it('takes a ProseMirror-representation state through the steps path too', async () => {
    const proseMirrorSteps = vi.fn(stepsTo);
    const { liveDocument, view } = await setup({ proseMirrorSteps });

    await Effect.runPromise(
      SubscriptionRef.set(liveDocument.content, {
        doc: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: richTextRepresentations.PROSEMIRROR,
          content: JSON.stringify(paragraph('from elsewhere').toJSON()),
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
    // A single region replace would span both edits and drag the caret
    // between them to its end.
    const { liveDocument, view, dispatched, onError } = await setup({
      initialText: 'hello world',
      proseMirrorSteps: () =>
        Effect.succeed({
          pmDocAfter: paragraph('Xhello worldY'),
          steps: [
            new ReplaceStep(1, 1, textSlice('X')),
            new ReplaceStep(13, 13, textSlice('Y')),
          ],
        }),
    });

    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 6))
    );
    const dispatchedBefore = dispatched.length;

    await Effect.runPromise(liveDocument.change('Xhello worldY'));

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('Xhello worldY')
    );
    expect(view.state.selection.head).toBe(7);
    expect(dispatched).toHaveLength(dispatchedBefore + 1);
    expect(dispatched[dispatchedBefore].steps).toHaveLength(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it('falls back to the region replace and reports when a step fails to apply', async () => {
    const { liveDocument, view, onError } = await setup({
      proseMirrorSteps: () =>
        Effect.succeed({
          pmDocAfter: paragraph('from elsewhere'),
          // Text straight under the doc node is invalid content.
          steps: [new ReplaceStep(0, 0, textSlice('x'))],
        }),
    });

    await Effect.runPromise(liveDocument.change('from elsewhere'));

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from elsewhere')
    );
    expect(
      reportedFallbackMessage({ onError, reason: 'steps-mismatch' })
    ).toContain('(step 0)');
  });

  it('falls back when the final doc mismatches', async () => {
    const { liveDocument, view, onError } = await setup({
      proseMirrorSteps: () =>
        Effect.succeed({ pmDocAfter: paragraph('from elsewhere'), steps: [] }),
    });

    await Effect.runPromise(liveDocument.change('from elsewhere'));

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('from elsewhere')
    );
    expect(
      reportedFallbackMessage({ onError, reason: 'steps-mismatch' })
    ).not.toContain('(step');
  });

  it('falls back to the converted doc and reports when hs-lib cannot produce steps', async () => {
    const { liveDocument, view, onError } = await setup({
      initialText: 'hello world',
      proseMirrorSteps: () =>
        Effect.fail(new PatchError('Cannot emit steps: table')),
    });

    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 6))
    );

    await Effect.runPromise(liveDocument.change('hello world and more'));

    await eventually(() =>
      expect(view.state.doc.textContent).toBe('hello world and more')
    );
    expect(view.state.selection.head).toBe(6);
    expect(
      reportedFallbackMessage({ onError, reason: 'steps-failed' })
    ).toContain('Cannot emit steps: table');
  });

  describe('what it shows of the live document', () => {
    it('starts at the initial version with no local edits pending', async () => {
      const { view } = await setup();

      expect(getLiveSyncState(view.state)).toEqual({
        baseVersion: '0',
        hasPendingLocalEdits: false,
      });
    });

    it('has a local edit pending until its version comes back', async () => {
      let resolveContribution: (() => void) | undefined;
      const content = await Effect.runPromise(
        SubscriptionRef.make<ConvergentDocumentState>({
          doc: markdownDocument('hello'),
          version: '0',
        })
      );
      const liveDocument: ConvergentDocument = {
        content,
        // Publishes before resolving, as the port contract requires.
        change: (text) =>
          pipe(
            Effect.promise(
              () =>
                new Promise<string>((resolve) => {
                  resolveContribution = () => resolve('1');
                })
            ),
            Effect.tap((version) =>
              SubscriptionRef.set(content, {
                doc: markdownDocument(text),
                version,
              })
            )
          ),
        presence: await Effect.runPromise(noPresence),
        errors: Stream.empty,
        close: Effect.void,
      };
      const { view } = await setup({
        createConvergentDocument: () => Promise.resolve(liveDocument),
      });

      view.dispatch(view.state.tr.insertText('!', 6));
      expect(getLiveSyncState(view.state)).toEqual({
        baseVersion: '0',
        hasPendingLocalEdits: true,
      });

      resolveContribution?.();
      await eventually(() =>
        expect(getLiveSyncState(view.state)).toEqual({
          baseVersion: '1',
          hasPendingLocalEdits: false,
        })
      );
    });

    it('shows the version of an incoming state once applied', async () => {
      const { liveDocument, view } = await setup();

      const version = await Effect.runPromise(
        liveDocument.change('hello from a peer')
      );

      await eventually(() =>
        expect(getLiveSyncState(view.state).baseVersion).toBe(version)
      );
    });

    it('has no local edit pending after a selection change', async () => {
      const { view } = await setup();

      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 3))
      );

      expect(getLiveSyncState(view.state).hasPendingLocalEdits).toBe(false);
    });
  });
});
