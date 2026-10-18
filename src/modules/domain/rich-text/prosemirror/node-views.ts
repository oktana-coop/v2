import { type NodeViewConstructor } from 'prosemirror-view';

import { FigureView, ImageView } from './assets';
import { CodeBlockView } from './code-blocks';

export const registerNodeViews = (): {
  [node: string]: NodeViewConstructor;
} => ({
  code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos),
  figure: (node, view, getPos) => new FigureView(node, view, getPos),
  image: (node, view, getPos) => new ImageView(node, view, getPos),
});
