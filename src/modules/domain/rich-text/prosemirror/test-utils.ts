import { type Node } from 'prosemirror-model';
import {
  type Command,
  EditorState,
  type Plugin,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';
import { type EditorView } from 'prosemirror-view';

import { schema } from './schema';

export const image = ({ src }: { src: string }): Node =>
  schema.node('image', { src, alt: null, title: null });

export const figureWith = ({ src }: { src: string }): Node =>
  schema.node('figure', null, [
    schema.node('figure_content', null, [image({ src })]),
  ]);

export const para = (text?: string): Node =>
  schema.node('paragraph', null, text ? [schema.text(text)] : []);

export const heading = ({
  text,
  level = 1,
}: { text?: string; level?: number } = {}): Node =>
  schema.node('heading', { level }, text ? [schema.text(text)] : []);

export const doc = (children: Node[]): Node =>
  schema.node('doc', { pandocMeta: null }, children);

export const editorState = (
  children: Node[],
  plugins: Plugin[] = []
): EditorState => EditorState.create({ doc: doc(children), plugins });

export const topLevelTypes = (state: EditorState): string[] =>
  state.doc.content.content.map((n) => n.type.name);

export const withCursorAt = ({
  state,
  pos,
}: {
  state: EditorState;
  pos: number;
}): EditorState =>
  state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));

// Run a command with a capturing dispatch and return the resulting state.
export const runCommand = ({
  state,
  command,
}: {
  state: EditorState;
  command: Command;
}) => {
  let tr: Transaction | undefined;
  const handled = command(state, (t) => {
    tr = t;
  });
  return { handled, next: tr ? state.apply(tr) : state };
};

// Some commands/orchestrators only touch `view.state`/`view.dispatch`, so a
// stub stands in for a real EditorView.
export const fakeView = (state: EditorState) => {
  const dispatch = vi.fn();
  return { view: { state, dispatch } as unknown as EditorView, dispatch };
};
