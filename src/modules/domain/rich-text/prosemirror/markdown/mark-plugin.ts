import { MarkType, Schema } from 'prosemirror-model';
import { Plugin, PluginKey, Selection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

export function markdownMarkPlugin(
  markType: MarkType,
  options: { delimiter: string; regex?: RegExp }
): Plugin {
  const key = new PluginKey(`markdownMark_${markType.name}`);

  let regex: RegExp;
  if (options.regex) {
    regex = options.regex;
  } else {
    const escaped = escapeRegExp(options.delimiter);
    regex = new RegExp(`${escaped}([^${escaped}\\n]+)${escaped}`);
  }

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
            // Find the end of the current mark at the cursor
            let markEnd = $from.pos;
            $from.parent.forEach((child, offset) => {
              if (
                child.isText &&
                child.text &&
                child.marks.some((m) => m.type === markType)
              ) {
                const start = $from.start() + offset;
                const end = start + child.text.length;
                if ($from.pos >= start && $from.pos <= end) {
                  markEnd = end;
                }
              }
            });

            // Only remove the mark if the cursor is at the end of the marked text
            if ($from.pos === markEnd) {
              // In this case we are at the end of a block. We need to make sure that:
              // 1. The user can continue typing in this block (break out of the marked span)
              // 2. Right arrow doesn't get "stuck" in the end of the marked section (e.g. does something on first press and then continues as usual)
              if ($from.parentOffset === $from.parent.content.size) {
                let tr = state.tr
                  // Remove the stored mark first
                  .removeStoredMark(markType)
                  // Insert a space at the cursor position
                  .insertText(' ', $from.pos)
                  .removeMark($from.pos, $from.pos + 1, markType);

                // Move the selection after the marked text
                tr = tr.setSelection(
                  Selection.near(tr.doc.resolve($from.pos + 1), 1)
                );

                dispatch(tr);
                event.preventDefault();
                return true;
              } else {
                // Not at end of block: move selection out of mark and remove stored mark
                const tr = state.tr
                  .setSelection(
                    Selection.near(state.doc.resolve($from.pos + 1), 1)
                  )
                  .removeStoredMark(markType);
                dispatch(tr);
                event.preventDefault();
                return true;
              }
            }
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

      // This part ends the mark when the user types the closing delimiter characters.
      const isTypingInside =
        cursorPos >= matchStart + options.delimiter.length &&
        cursorPos <= matchEnd - options.delimiter.length;

      if (!isTypingInside) {
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
  markdownMarkPlugin(schema.marks.code, { delimiter: '`' }),
  markdownMarkPlugin(schema.marks.strong, { delimiter: '**' }),
  markdownMarkPlugin(schema.marks.strong, { delimiter: '__' }),
  markdownMarkPlugin(schema.marks.em, {
    delimiter: '*',
    regex: /(?<!\*)\*([^*\n]+)\*(?!\*)/,
  }),
  markdownMarkPlugin(schema.marks.em, {
    delimiter: '_',
    regex: /(?<!_)_([^_\n]+)_(?!_)/,
  }),
];
