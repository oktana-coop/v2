import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Node as PMNode } from 'prosemirror-model';
import { EditorState, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAdapter } from '../../adapters/in-memory-live-document';
import {
  CURRENT_SCHEMA_VERSION,
  type RichTextDocument,
  richTextRepresentations,
} from '../../models';
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

// The bridge subscribes on a fiber and converts asynchronously; give both a
// few turns before asserting.
const settle = async () => {
  for (let turn = 0; turn < 3; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const textOf = (doc: RichTextDocument) =>
  pmDocFromJSONString(JSON.parse(doc.content), schema).textContent;

const views: EditorView[] = [];

const setup = async ({
  initialText = 'hello',
  convertToProseMirror = async (doc: RichTextDocument) =>
    paragraph(doc.content),
}: {
  initialText?: string;
  convertToProseMirror?: (doc: RichTextDocument) => Promise<PMNode>;
} = {}) => {
  const live = await Effect.runPromise(
    createAdapter(markdownDocument(initialText))
  );
  const initial = await Effect.runPromise(SubscriptionRef.get(live.content));
  const onError = vi.fn();
  const dispatched: Transaction[] = [];

  const state = EditorState.create({
    schema,
    doc: paragraph(initialText),
    plugins: [
      liveSyncPlugin({
        live,
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

  await settle();

  return { live, view, dispatched, onError };
};

describe('liveSyncPlugin', () => {
  afterEach(() => {
    views.splice(0).forEach((view) => view.destroy());
  });

  it('sends local edits to the live document', async () => {
    const { live, view } = await setup();

    view.dispatch(view.state.tr.insertText(' world', 6));
    await settle();

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));

    expect(current.doc.representation).toBe(
      richTextRepresentations.PROSEMIRROR
    );
    expect(textOf(current.doc)).toBe('hello world');
  });

  it('applies an external change as a transaction on the same view', async () => {
    const { live, view, dispatched } = await setup();
    const domBefore = view.dom;

    await Effect.runPromise(live.change(markdownDocument('from elsewhere')));
    await settle();

    expect(view.state.doc.textContent).toBe('from elsewhere');
    expect(view.dom).toBe(domBefore);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].getMeta('addToHistory')).toBe(false);
  });

  it('does not echo a local edit back into the editor', async () => {
    const { view, dispatched } = await setup();

    view.dispatch(view.state.tr.insertText('!', 6));
    await settle();

    expect(dispatched).toHaveLength(1);
    expect(view.state.doc.textContent).toBe('hello!');
  });

  it('dispatches nothing for an emission that matches the current document', async () => {
    const { live, dispatched } = await setup({
      convertToProseMirror: async (doc) => paragraph(doc.content.trim()),
    });

    const version = await Effect.runPromise(
      live.change(markdownDocument('hello  '))
    );
    await settle();

    expect(version).toBe('1');
    expect(dispatched).toHaveLength(0);
  });
});
