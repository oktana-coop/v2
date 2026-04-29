import {
  InputRule,
  textblockTypeInputRule,
  wrappingInputRule,
} from 'prosemirror-inputrules';
import { NodeType } from 'prosemirror-model';

// Based on https://github.com/ProseMirror/prosemirror-example-setup/blob/master/src/inputrules.ts
export const headingRule = (nodeType: NodeType, maxLevel: number) => {
  return textblockTypeInputRule(
    new RegExp('^(#{1,' + maxLevel + '})\\s$'),
    nodeType,
    (match) => ({ level: match[1].length })
  );
};

export const codeBlockRule = (nodeType: NodeType) => {
  return textblockTypeInputRule(/^```(?:\s*)$/, nodeType, () => ({}));
};

export const blockquoteRule = (nodeType: NodeType) => {
  return wrappingInputRule(/^>\s$/, nodeType);
};

// Given a list node type, returns an input rule that turns a bullet
// (dash, plush, or asterisk) at the start of a textblock into a bullet list.
// Based on https://github.com/ProseMirror/prosemirror-example-setup/blob/master/src/inputrules.ts
export function bulletListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType);
}

// Given a list node type, returns an input rule that turns a number
// followed by a dot at the start of a textblock into an ordered list.
// Based on https://github.com/ProseMirror/prosemirror-example-setup/blob/master/src/inputrules.ts
export function orderedListRule(nodeType: NodeType) {
  return wrappingInputRule(
    /^(\d+)\.\s$/,
    nodeType,
    (match) => ({ order: +match[1] }),
    (match, node) => node.childCount + node.attrs.order == +match[1]
  );
}

export const horizontalRuleRule = (nodeType: NodeType) =>
  new InputRule(/^---$/, (state, _match, start, end) => {
    const $start = state.doc.resolve(start);
    // The regex matches `textBefore` (textblock-start → cursor); it can't see
    // content after the cursor. Without this guard, typing `---` at the start
    // of a non-empty paragraph would also fire and wipe the trailing content.
    if (end - start !== $start.parent.content.size) {
      return null;
    }

    return state.tr.replaceRangeWith(
      $start.before(),
      $start.after(),
      nodeType.create()
    );
  });

export const emDashRule = () =>
  new InputRule(/---$/, (state, _match, start, end) =>
    state.tr.replaceWith(start, end, state.schema.text('—'))
  );

export const enDashRule = () =>
  new InputRule(/(?<=[^-])--\s$/, (state, _match, start, end) =>
    // HTML collapses trailing whitespace at the end of a block element and the
    // en dash is typically added after the user types a space after 2 dashes.
    // We want to preserve this trailing space so that they continue typing, this is why
    // we add an non-breaking space at the end.
    state.tr.replaceWith(start, end, state.schema.text('–\u00a0'))
  );
