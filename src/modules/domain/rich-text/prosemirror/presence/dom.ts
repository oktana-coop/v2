import { type EditorView } from 'prosemirror-view';

// A cursor line with a label above it, both in the given colour.
export const caretElement = ({
  label,
  colorClass,
}: {
  label: string;
  colorClass: string;
}) => {
  const caret = document.createElement('span');
  caret.className =
    'presence-caret pointer-events-none relative inline-block h-[1.15em] w-0 align-text-bottom';
  caret.dataset.testid = 'presence-caret';
  caret.setAttribute('aria-hidden', 'true');

  const cursorSpan = document.createElement('span');
  cursorSpan.className = `absolute -left-px top-0 h-full w-0.5 ${colorClass}`;

  // The label is drawn from the attribute, not held as content: the editor's
  // text content stays the document's own.
  const labelSpan = document.createElement('span');
  labelSpan.className = `presence-caret-label absolute -left-px -top-5 whitespace-nowrap rounded px-1 text-xs leading-5 after:content-[attr(data-name)] ${colorClass}`;
  labelSpan.dataset.name = label;

  caret.append(cursorSpan, labelSpan);

  return caret;
};

// The label sits above the caret, except on a first line, where the editor
// would clip it: there it hangs below.
const LABEL_HEIGHT_PX = 20;

export const placeLabels = (view: EditorView) => {
  const editorTop = view.dom.getBoundingClientRect().top;

  for (const caret of view.dom.querySelectorAll('.presence-caret')) {
    const label = caret.querySelector('.presence-caret-label');
    if (label === null) continue;

    const noRoomAbove =
      caret.getBoundingClientRect().top - editorTop < LABEL_HEIGHT_PX;
    label.classList.toggle('-top-5', !noRoomAbove);
    label.classList.toggle('top-full', noRoomAbove);
  }
};
