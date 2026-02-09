import { type NodeViewConstructor } from 'prosemirror-view';

import { CodeBlockView } from './code-blocks/CodeBlockView';

export const registerNodeViews = (): {
  [node: string]: NodeViewConstructor;
} => ({
  code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos),
});
