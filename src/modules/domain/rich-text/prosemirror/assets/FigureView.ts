import { Node as PMNode } from 'prosemirror-model';
import { EditorView, type NodeView } from 'prosemirror-view';

import { figure as figureClasses } from '../../../../../renderer/src/components/editing/blocks';

// FigureView is a thin container NodeView. PM renders the figure's
// children (a paragraph holding the inline image, plus an optional
// caption) into `contentDOM`. The inline `image` node has its own
// NodeView (ImageView) which handles src resolution and the
// non-image placeholder rendering.
export class FigureView implements NodeView {
  node: PMNode;
  view: EditorView;
  getPos: () => number | undefined;

  dom: HTMLElement;
  contentDOM: HTMLElement;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('figure');
    this.dom.className = figureClasses;
    this.contentDOM = this.dom;
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    return true;
  }
}
