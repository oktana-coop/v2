import { type NodeViewConstructor } from 'prosemirror-view';

import { FigureView, ImageView, type ResolveAssetSrc } from './assets';
import { CodeBlockView } from './code-blocks';

export type RegisterNodeViewsOptions = {
  // Resolves a stored `node.attrs.src` to a renderable URL. The caller
  // owns whatever the resolution means (project-asset URL, blob URL,
  // identity). Omit for contexts without a project — `src` is then used
  // verbatim.
  resolveAssetSrc?: ResolveAssetSrc;
};

export const registerNodeViews = (
  options: RegisterNodeViewsOptions = {}
): {
  [node: string]: NodeViewConstructor;
} => ({
  code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos),
  figure: (node, view, getPos) => new FigureView(node, view, getPos),
  image: (node, view, getPos) =>
    new ImageView(node, view, getPos, {
      resolveAssetSrc: options.resolveAssetSrc,
    }),
});
