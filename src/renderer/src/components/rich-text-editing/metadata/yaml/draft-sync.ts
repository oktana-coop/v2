import {
  Annotation,
  type Extension,
  Prec,
  Transaction,
} from '@codemirror/state';
import { type Command, EditorView, keymap, ViewPlugin } from '@codemirror/view';

// Marks the transactions that bring the document's front matter into the
// editor, which aren't typing.
const incoming = Annotation.define<boolean>();

export const draftSync = ({
  onChange,
  onViewChange,
}: {
  onChange: (text: string) => void;
  onViewChange: (view: EditorView | null) => void;
}): Extension => [
  EditorView.updateListener.of((update) => {
    if (
      update.docChanged &&
      update.transactions.some((tr) => !tr.annotation(incoming))
    ) {
      onChange(update.state.doc.toString());
    }
  }),
  ViewPlugin.define((view) => {
    onViewChange(view);
    return {
      destroy: () => {
        onViewChange(null);
      },
    };
  }),
];

export const replaceWithDocumentText = ({
  view,
  text,
}: {
  view: EditorView;
  text: string;
}) => {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    annotations: [incoming.of(true), Transaction.addToHistory.of(false)],
  });
};

const asCommand =
  (action: () => void): Command =>
  () => {
    action();
    return true;
  };

const restoreSource =
  (getSource: () => string): Command =>
  (view) => {
    const source = getSource();

    if (view.state.doc.toString() === source) {
      return false;
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: source },
    });
    return true;
  };

export const draftKeymap = ({
  commit,
  getSource,
}: {
  commit: () => void;
  getSource: () => string;
}): Extension => [
  Prec.highest(keymap.of([{ key: 'Mod-Enter', run: asCommand(commit) }])),
  keymap.of([{ key: 'Escape', run: restoreSource(getSource) }]),
];
