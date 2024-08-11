import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
} from 'prosemirror-inputrules';
import { Attrs, MarkType, NodeType, Schema } from 'prosemirror-model';
import { Transaction } from 'prosemirror-state';

// Based on https://github.com/ProseMirror/prosemirror-example-setup/blob/master/src/inputrules.ts
const headingRule = (nodeType: NodeType, maxLevel: number) => {
  return textblockTypeInputRule(
    new RegExp('^(#{1,' + maxLevel + '})\\s$'),
    nodeType,
    (match) => ({ level: match[1].length })
  );
};

// Based on https://discuss.prosemirror.net/t/input-rules-for-wrapping-marks/537/11
const markInputRule = (
  regexp: RegExp,
  markType: MarkType,
  getAttrs?: Attrs | ((match: RegExpMatchArray) => Attrs | null) | null
): InputRule => {
  return new InputRule(regexp, (state, match, start, end) => {
    const attrs = typeof getAttrs === 'function' ? getAttrs(match) : getAttrs;
    if (attrs === null) return null;

    const tr: Transaction = state.tr;

    if (match[1]) {
      const textStart = start + match[0].indexOf(match[1]);
      const textEnd = textStart + match[1].length;

      if (textEnd < end) tr.delete(textEnd, end);
      if (textStart > start) tr.delete(start, textStart);

      end = start + match[1].length;
    }

    tr.addMark(start, end, markType.create(attrs || {}));
    tr.removeStoredMark(markType);
    return tr;
  });
};

// Regex patterns for strong and em marks based on (but not identical to)
// https://discuss.prosemirror.net/t/input-rules-for-wrapping-marks/537/12
const strongAsteriskMarkRule = (schema: Schema) =>
  markInputRule(/(?:\*\*)([^*]+)(?:\*\*)/, schema.marks.strong);

const strongUnderscoreMarkRule = (schema: Schema) =>
  markInputRule(/(?:__)([^_]+)(?:__)/, schema.marks.strong);

// Emphasis marks include negative lookbehind to avoid matching soon-to-be bold text
const emAsteriskMarkRule = (schema: Schema) =>
  markInputRule(/(?<!\*)(?:\*)([^*]+)(?:\*)/, schema.marks.em);

const emUnderscorekMarkRule = (schema: Schema) =>
  markInputRule(/(?<!_)(?:__)([^_]+)(?:__)/, schema.marks.em);

export const buildInputRules = (schema: Schema) => {
  return inputRules({
    rules: [
      headingRule(schema.nodes.heading, 4),
      strongAsteriskMarkRule(schema),
      strongUnderscoreMarkRule(schema),
      emAsteriskMarkRule(schema),
      emUnderscorekMarkRule(schema),
    ],
  });
};
