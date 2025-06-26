import { MarkType } from 'prosemirror-model';
import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { interceptIfAtTheEndOfMark } from './mark-breakout';

type MarkConfig = {
  delimiter: string;
  regex?: RegExp;
};

const escapeRegExp = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createRegex = (delimiter: string): RegExp => {
  const escaped = escapeRegExp(delimiter);
  return new RegExp(`${escaped}([^${escaped}\\n]+)${escaped}`);
};

const processMarkdownMarkMatches = (
  newState: EditorState,
  regex: RegExp,
  markType: MarkType,
  delimiter: string
): Transaction | null => {
  const { selection } = newState;
  const { $from } = selection;
  const text = $from.parent.textContent;
  const match = regex.exec(text);

  if (!match) return null;

  const [fullMatch, innerText] = match;
  const startIndex = match.index!;
  const pos = $from.start();
  const matchStart = pos + startIndex;
  const matchEnd = matchStart + fullMatch.length;

  const tr = newState.tr
    .delete(matchStart, matchEnd)
    .insertText(innerText, matchStart)
    .addMark(matchStart, matchStart + innerText.length, markType.create());

  // This part enables continuing with plain text when the user types the closing delimiter characters.
  const cursorPos = selection.from;
  const isOutsideDelimiters =
    cursorPos < matchStart + delimiter.length ||
    cursorPos > matchEnd - delimiter.length;

  if (isOutsideDelimiters) {
    tr.removeStoredMark(markType);
  }

  return tr;
};

export const markdownMarkPlugin = (
  markType: MarkType,
  config: MarkConfig
): Plugin => {
  const key = new PluginKey(`markdown-mark-${markType.name}`);
  const regex = config.regex || createRegex(config.delimiter);

  return new Plugin({
    key,
    appendTransaction: (
      transactions: readonly Transaction[],
      _: EditorState,
      newState: EditorState
    ) => {
      const hasDocChanges = transactions.some((tr) => tr.docChanged);
      return hasDocChanges
        ? processMarkdownMarkMatches(
            newState,
            regex,
            markType,
            config.delimiter
          )
        : null;
    },
    props: {
      handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
        if (event.key === 'ArrowRight') {
          const intercepted = interceptIfAtTheEndOfMark(view, markType);
          if (intercepted) {
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
  });
};
