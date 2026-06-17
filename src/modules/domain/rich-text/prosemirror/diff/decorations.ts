import { DOMSerializer, Node, type Schema } from 'prosemirror-model';
import { Decoration } from 'prosemirror-view';

type DOMNode = globalThis.Node;
type DOMText = globalThis.Text;

// Semantic diff class for deleted content. Insert/modify decorations carry diff classes alrady.
export const diffDeleteClass = 'diff-delete';

export type CreateInlineDecorationArgs = {
  from: number;
  to: number;
  className: string;
};

export const createInlineDecoration = ({
  from,
  to,
  className,
}: CreateInlineDecorationArgs) =>
  Decoration.inline(from, to, { class: className });

export type CreateNodeDecorationArgs = {
  from: number;
  to: number;
  className: string;
};

export const createNodeDecoration = ({
  from,
  to,
  className,
}: CreateNodeDecorationArgs) => Decoration.node(from, to, { class: className });

export type CreateWidgetDeleteDecorationArgs = {
  pos: number;
  node: Node;
  proseMirrorSchema: Schema;
  transformImageSrc: (src: string) => string;
};

const transformImageSources = ({
  fragment,
  transform,
}: {
  fragment: DOMNode;
  transform: (src: string) => string;
}) => {
  // `fragment` may itself be the <img> element when the deleted node is an
  // inline image — querySelectorAll only walks descendants, so handle the
  // root case explicitly.
  if (fragment instanceof HTMLImageElement) {
    fragment.src = transform(fragment.getAttribute('src') ?? '');
    return;
  }

  if (fragment instanceof Element) {
    fragment.querySelectorAll('img').forEach((img) => {
      img.src = transform(img.getAttribute('src') ?? '');
    });
  }
};

export const createWidgetDeleteDecoration = ({
  pos,
  node,
  proseMirrorSchema,
  transformImageSrc,
}: CreateWidgetDeleteDecorationArgs) =>
  Decoration.widget(pos, () => {
    const domSerializer = DOMSerializer.fromSchema(proseMirrorSchema);
    const docFragment = domSerializer.serializeNode(node);

    transformImageSources({
      fragment: docFragment,
      transform: transformImageSrc,
    });

    if (node.isInline) {
      return createDeletedInlineElement(docFragment);
    }

    return createDeletedBlockElement(docFragment);
  });

const createDeletedInlineElement = (docFragment: DOMNode) => {
  const element = document.createElement('span');
  element.className = diffDeleteClass;
  element.appendChild(docFragment);
  return element;
};

const createDeletedBlockElement = (docFragment: DOMNode) => {
  const element = document.createElement('div');
  element.appendChild(docFragment);

  const getTextNodes = (node: DOMNode): DOMText[] =>
    [...node.childNodes].flatMap(
      (child) =>
        child.nodeType === globalThis.Node.TEXT_NODE && child.nodeValue?.trim()
          ? [child as DOMText] // Type assertion since we check `nodeType`
          : getTextNodes(child) // Recursively get all text nodes
    );

  const wrapNode = (textNode: Text): void => {
    const span = document.createElement('span');
    span.className = diffDeleteClass;
    span.textContent = textNode.nodeValue;
    textNode.replaceWith(span);
  };

  const textNodes = getTextNodes(element);

  if (textNodes.length === 0) {
    // Leaf block (e.g. horizontal_rule) has no text content to wrap. Mark
    // the wrapper itself so the delete styling still appears.
    element.className = diffDeleteClass;
  } else {
    textNodes.forEach(wrapNode);
  }

  return element;
};
