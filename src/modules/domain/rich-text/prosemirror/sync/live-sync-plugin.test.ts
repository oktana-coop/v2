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
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RepresentationTransformError,
  ValidationError,
  WebEditorError,
} from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
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
import { liveSyncPlugin } from './live-sync-plugin';

const markdownDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.MARKDOWN,
  content,
});

const paragraph = (text: string): PMNode =>
  schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text(text)]),
  ]);

// Blank lines make blocks, as the primary representation does.
const paragraphs = (text: string): PMNode =>
  schema.node(
    'doc',
    null,
    text
      .split('\n\n')
      .map((part) => schema.node('paragraph', null, [schema.text(part)]))
  );

// The editor contributes its own representation; everything else is already
// the primary text one.
const textOf = (doc: RichTextDocument) =>
  doc.representation === richTextRepresentations.PROSEMIRROR
    ? pmDocFromJSONString(JSON.parse(doc.content), schema).textContent
    : doc.content;

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
      SubscriptionRef.make<ConvergentDocumentState>({
        doc: markdownDocument(initialText),
        version: '0',
      }),
      Effect.map((content) => {
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

        return { content, change, errors: Stream.empty, close: Effect.void };
      })
    )
  );

const views: EditorView[] = [];

const setup = async ({
  initialText = 'hello',
  initialDoc,
  convertToProseMirror = async (doc: RichTextDocument) =>
    paragraph(doc.content),
  createConvergentDocument = (text: string) =>
    createConvergentDocumentInMemory(text),
}: {
  initialText?: string;
  initialDoc?: PMNode;
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
    doc: initialDoc ?? paragraph(initialText),
    plugins: [
      liveSyncPlugin({
        content: liveDocument.content,
        onChange: change,
        initialVersion: initial.version,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        schema,
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

  // A peer's edits arrive batched, so one change can carry edits in several
  // blocks at once. Replacing everything from the first to the last would take
  // the untouched block between them — and the caret resting in it — with it.
  it('leaves a block between two incoming edits alone', async () => {
    const initialText = 'one\n\ntwo\n\nthree';
    const { liveDocument, view } = await setup({
      initialText,
      initialDoc: paragraphs(initialText),
      convertToProseMirror: async (doc) => paragraphs(doc.content),
    });

    // The caret rests inside the middle block.
    const middle = view.state.doc.resolve(8);
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 8))
    );

    await Effect.runPromise(
      liveDocument.change('one EDITED\n\ntwo\n\nthree EDITED')
    );

    await eventually(() =>
      expect(view.state.doc.textContent).toContain('three EDITED')
    );

    // It has moved along with the text inserted above it, which is the point:
    // still the same block, still the same spot inside it.
    const caret = view.state.selection.$head;
    expect(caret.index(0)).toBe(middle.index(0));
    expect(caret.parentOffset).toBe(middle.parentOffset);
    expect(caret.parent.textContent).toBe('two');
  });

  it('does not wipe a keystroke made while an incoming state was converting', async () => {
    const { liveDocument, view, dispatched } = await setup({
      convertToProseMirror: async (doc) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return paragraph(doc.content);
      },
    });

    await Effect.runPromise(liveDocument.change('from elsewhere'));
    // The incoming state is converting; a keystroke lands meanwhile.
    await new Promise((resolve) => setTimeout(resolve, 10));
    view.dispatch(view.state.tr.insertText('!', 6));
    const dispatchedAfterTyping = dispatched.length;

    // The lagging state is dropped, never applied-then-healed: the editor
    // must not dispatch at all, and the keystroke must survive throughout.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(view.state.doc.textContent).toContain('!');
    expect(dispatched).toHaveLength(dispatchedAfterTyping);
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
      errors: Stream.empty,
      close: Effect.void,
    };

    const { view, dispatched } = await setup({
      createConvergentDocument: () => Promise.resolve(echoing),
    });

    view.dispatch(view.state.tr.insertText('!', 6));
    const typed = view.state.doc.textContent;
    const dispatchedAfterTyping = dispatched.length;

    // Give the echo its chance to arrive, then assert it changed nothing.
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(view.state.doc.textContent).toBe(typed);
    expect(dispatched).toHaveLength(dispatchedAfterTyping);
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
      convertToProseMirror: async (doc) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return paragraph(doc.content);
      },
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
    let call = 0;
    const { liveDocument, view, onError } = await setup({
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
      convertToProseMirror: async () => null as unknown as PMNode,
    });

    await Effect.runPromise(liveDocument.change('anything'));

    await eventually(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(WebEditorError);
  });

  it('reports malformed stored ProseMirror content as a validation error', async () => {
    const { liveDocument, onError } = await setup();

    // A published ProseMirror-representation state whose content is not valid
    // JSON fails parsing rather than transforming — a validation concern.
    await Effect.runPromise(
      SubscriptionRef.set(liveDocument.content, {
        doc: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: richTextRepresentations.PROSEMIRROR,
          content: 'not json',
        },
        version: 'malformed',
      })
    );

    await eventually(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(ValidationError);
  });
});
