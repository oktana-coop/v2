import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Node as PMNode } from 'prosemirror-model';
import { EditorState, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAdapter } from '../../adapters/in-memory-live-document';
import {
  RepresentationTransformError,
  ValidationError,
  WebEditorError,
} from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  type RichTextDocument,
  richTextRepresentations,
} from '../../models';
import {
  type LiveDocument,
  type LiveDocumentChangeOptions,
} from '../../ports/live-document';
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

const textOf = (doc: RichTextDocument) =>
  pmDocFromJSONString(JSON.parse(doc.content), schema).textContent;

// Sync lands on plugin-internal fibers the test can't await, so state is
// reached asynchronously; `eventually` polls its assertions until they hold.
const eventually = (assertions: () => void | Promise<void>) =>
  vi.waitFor(assertions);

const views: EditorView[] = [];

const setup = async ({
  initialText = 'hello',
  convertToProseMirror = async (doc: RichTextDocument) =>
    paragraph(doc.content),
}: {
  initialText?: string;
  convertToProseMirror?: (doc: RichTextDocument) => Promise<PMNode>;
} = {}) => {
  const liveDocument = await Effect.runPromise(
    createAdapter(markdownDocument(initialText))
  );
  const initial = await Effect.runPromise(
    SubscriptionRef.get(liveDocument.content)
  );
  const onError = vi.fn();
  const dispatched: Transaction[] = [];

  // Records what the plugin contributes, so tests can assert on the options.
  const changeCalls: Array<{
    doc: RichTextDocument;
    options: LiveDocumentChangeOptions | undefined;
  }> = [];
  const trackedLiveDocument: LiveDocument = {
    content: liveDocument.content,
    change: (doc, options) => {
      changeCalls.push({ doc, options });
      return liveDocument.change(doc, options);
    },
  };

  const state = EditorState.create({
    schema,
    doc: paragraph(initialText),
    plugins: [
      liveSyncPlugin({
        liveDocument: trackedLiveDocument,
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
      expect(current.doc.representation).toBe(
        richTextRepresentations.PROSEMIRROR
      );
      expect(textOf(current.doc)).toBe('hello world');
    });
  });

  it('anchors local edits at the version shown in the editor', async () => {
    const { liveDocument, view, changeCalls } = await setup();

    view.dispatch(view.state.tr.insertText(' world', 6));

    await eventually(() => expect(changeCalls).toHaveLength(1));
    expect(changeCalls[0].options).toEqual({ base: '0' });

    await Effect.runPromise(
      liveDocument.change(markdownDocument('from elsewhere'))
    );
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

    await Effect.runPromise(
      liveDocument.change(markdownDocument('from elsewhere'))
    );

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
      await Effect.runPromise(liveDocument.change(markdownDocument(text)));
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

    await Effect.runPromise(liveDocument.change(markdownDocument('breaks')));
    // Wait for the failing change to be handled before issuing the next, so
    // it isn't conflated away.
    await eventually(() => expect(onError).toHaveBeenCalledTimes(1));

    await Effect.runPromise(liveDocument.change(markdownDocument('recovers')));
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

    await Effect.runPromise(liveDocument.change(markdownDocument('anything')));

    await eventually(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(WebEditorError);
  });

  it('reports malformed stored ProseMirror content as a validation error', async () => {
    const { liveDocument, onError } = await setup();

    // A ProseMirror-representation change whose content is not valid JSON fails
    // parsing rather than transforming — a validation concern.
    await Effect.runPromise(
      liveDocument.change({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        representation: richTextRepresentations.PROSEMIRROR,
        content: 'not json',
      })
    );

    await eventually(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(ValidationError);
  });
});
