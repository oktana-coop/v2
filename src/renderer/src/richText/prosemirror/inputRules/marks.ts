import { InputRule } from 'prosemirror-inputrules';
import { Attrs, MarkType, Schema } from 'prosemirror-model';
import { Transaction } from 'prosemirror-state';

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
export const strongAsteriskRegexp = /(?:\*\*)([^*]+)(?:\*\*)/;
export const strongUnderscoreRegexp = /(?:__)([^_]+)(?:__)/;
// Emphasis marks include negative lookbehind to avoid matching soon-to-be bold text
export const emAsteriskRegexp = /(?<!\*)(?:\*)([^*]+)(?:\*)/;
export const emUnderscoreRegexp = /(?<!_)(?:_)([^_]+)(?:_)/;

export const strongAsteriskMarkRule = (schema: Schema) =>
  markInputRule(strongAsteriskRegexp, schema.marks.strong);

export const strongUnderscoreMarkRule = (schema: Schema) =>
  markInputRule(strongUnderscoreRegexp, schema.marks.strong);

export const emAsteriskMarkRule = (schema: Schema) =>
  markInputRule(emAsteriskRegexp, schema.marks.em);

export const emUnderscorekMarkRule = (schema: Schema) =>
  markInputRule(emUnderscoreRegexp, schema.marks.em);
