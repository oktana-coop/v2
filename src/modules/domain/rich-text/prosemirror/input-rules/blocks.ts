import {
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
