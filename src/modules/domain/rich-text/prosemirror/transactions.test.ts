import { wrapIn } from 'prosemirror-commands';
import { type Transaction } from 'prosemirror-state';

import { schema } from './schema';
import { editorState, figureWith, para } from './test-utils';
import {
  transactionsInsertedNodeOfType,
  transactionsMayHaveRemovedContent,
} from './transactions';

describe('transactionsMayHaveRemovedContent', () => {
  it('is true when a step deletes content', () => {
    const state = editorState([para('hello')]);
    const tr = state.tr.delete(1, 4);
    expect(transactionsMayHaveRemovedContent({ transactions: [tr] })).toBe(
      true
    );
  });

  it('is false when nothing changes', () => {
    const state = editorState([para('hello')]);
    expect(
      transactionsMayHaveRemovedContent({ transactions: [state.tr] })
    ).toBe(false);
  });

  it('is false for pure insertion (typing)', () => {
    const state = editorState([para('hello')]);
    const tr = state.tr.insertText('x', 1);
    expect(transactionsMayHaveRemovedContent({ transactions: [tr] })).toBe(
      false
    );
  });

  it('treats a wrap as a potential removal even though no content is lost', () => {
    const state = editorState([para('hello')]);
    let wrapped: Transaction | undefined;
    wrapIn(schema.nodes.blockquote)(state, (tr) => {
      wrapped = tr;
    });
    expect(wrapped).toBeDefined();
    expect(
      transactionsMayHaveRemovedContent({
        transactions: [wrapped as Transaction],
      })
    ).toBe(true);
  });
});

describe('transactionsInsertedNodeOfType', () => {
  it('detects an inserted node of the target type', () => {
    const state = editorState([para()]);
    const tr = state.tr.insert(0, figureWith({ src: 'a.jpg' }));
    expect(
      transactionsInsertedNodeOfType({
        transactions: [tr],
        types: [schema.nodes.figure],
      })
    ).toBe(true);
  });

  it('detects a target type nested inside the inserted slice', () => {
    const state = editorState([para()]);
    const tr = state.tr.insert(0, figureWith({ src: 'a.jpg' }));
    expect(
      transactionsInsertedNodeOfType({
        transactions: [tr],
        types: [schema.nodes.image],
      })
    ).toBe(true);
  });

  it('is false when the inserted content has no target type', () => {
    const state = editorState([para()]);
    const tr = state.tr.insertText('hello', 1);
    expect(
      transactionsInsertedNodeOfType({
        transactions: [tr],
        types: [schema.nodes.figure],
      })
    ).toBe(false);
  });
});
