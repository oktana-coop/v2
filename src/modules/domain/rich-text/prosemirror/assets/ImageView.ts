import { Node as PMNode } from 'prosemirror-model';
import { EditorView, type NodeView } from 'prosemirror-view';

import {
  getExtension,
  removePath,
} from '../../../../../modules/infrastructure/filesystem';

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'avif',
]);

const isImageSrc = (src: string) =>
  IMAGE_EXTENSIONS.has(getExtension(src).toLowerCase());

// Maps the raw, unvalidated `node.attrs.src` to a renderable URL. The editor
// passes the attr through verbatim, so the implementation owns validation and
// must handle malformed input gracefully (e.g. returning the src unchanged).
export type ResolveAssetSrc = (src: string) => string;

export type ImageViewOptions = {
  resolveAssetSrc: ResolveAssetSrc;
};

export class ImageView implements NodeView {
  node: PMNode;
  view: EditorView;
  getPos: () => number | undefined;
  options: ImageViewOptions;
  dom: HTMLElement;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    options: ImageViewOptions
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.options = options;
    this.dom = this.render(node);
  }

  private resolveSrc(src: string): string {
    return this.options.resolveAssetSrc(src);
  }

  private render(node: PMNode): HTMLElement {
    const { src, alt, title } = node.attrs as {
      src: string;
      alt: string | null;
      title: string | null;
    };

    if (isImageSrc(src)) {
      const img = document.createElement('img');
      img.src = this.resolveSrc(src);
      if (alt != null) img.alt = alt;
      if (title != null) img.title = title;
      return img;
    }

    const placeholder = document.createElement('span');
    placeholder.className =
      'inline-flex items-center gap-2 px-3 py-2 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-sm';
    placeholder.setAttribute('data-file-placeholder', 'true');
    placeholder.textContent = removePath(src);
    return placeholder;
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;

    const prev = this.node.attrs;
    const next = node.attrs;
    if (
      prev.src === next.src &&
      prev.alt === next.alt &&
      prev.title === next.title
    ) {
      this.node = node;
      return true;
    }

    // Rebuild from scratch on any attr/src change so render() re-picks the img/placeholder branch.
    return false;
  }

  // Atom view with no contentDOM: ignore all DOM mutations (e.g. img load) so PM never re-parses them as edits.
  ignoreMutation(): boolean {
    return true;
  }
}
