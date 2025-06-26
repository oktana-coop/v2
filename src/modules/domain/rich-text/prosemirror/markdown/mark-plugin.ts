import { MarkType, Schema } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

export function markdownMarkPlugin(
  markType: MarkType,
  delimiter: string
): Plugin {
  const key = new PluginKey(`markdownMark_${markType.name}`);
  const escaped = escapeRegExp(delimiter);
  const regex = new RegExp(`${escaped}([^${escaped}\\n]+)${escaped}`);

  return new Plugin({
    key,
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent) {
        if (event.key === 'ArrowRight') {
          const { state, dispatch } = view;
          const {
            storedMarks,
            selection: { $from },
          } = state;

          const activeMarks = $from.marks();

          if (
            storedMarks?.some((mark) => mark.type === markType) ||
            activeMarks.some((mark) => mark.type === markType)
          ) {
            // Remove the mark when right arrow is pressed
            dispatch(state.tr.removeStoredMark(markType));
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
    appendTransaction(transactions, oldState, newState) {
      const changed = transactions.some((tr) => tr.docChanged);
      if (!changed) return null;

      const { selection } = newState;
      const { $from } = selection;
      const parent = $from.parent;
      const text = parent.textContent;
      const match = regex.exec(text);
      if (!match) return null;

      const fullMatch = match[0];
      const innerText = match[1];
      const startIndex = match.index;

      const pos = $from.start(); // start of parent block
      const matchStart = pos + startIndex;
      const matchEnd = matchStart + fullMatch.length;

      const tr = newState.tr;
      tr.delete(matchStart, matchEnd);
      tr.insertText(innerText, matchStart);
      tr.addMark(matchStart, matchStart + innerText.length, markType.create());

      const cursorPos = selection.from;

      const isTypingInside =
        cursorPos >= matchStart + delimiter.length &&
        cursorPos <= matchEnd - delimiter.length;

      if (!isTypingInside) {
        // If user just typed `**bold**`, remove the stored mark
        tr.removeStoredMark(markType);
      }
      // Otherwise, allow stored mark to continue
      return tr;
    },
  });
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const markdownMarkPlugins = (schema: Schema) => [
  markdownMarkPlugin(schema.marks.code, '`'),
  markdownMarkPlugin(schema.marks.em, '*'),
];
