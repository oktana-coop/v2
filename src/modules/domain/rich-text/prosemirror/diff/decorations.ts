import { DOMSerializer, Node, type Schema } from 'prosemirror-model';
import { Decoration } from 'prosemirror-view';

type DOMNode = globalThis.Node;
type DOMText = globalThis.Text;

export type DiffDecorationClasses = {
  insert: string;
  modify: string;
  delete: string;
};

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
  decorationClasses: DiffDecorationClasses;
};

export const createWidgetDeleteDecoration = ({
  pos,
  node,
  proseMirrorSchema,
  decorationClasses,
}: CreateWidgetDeleteDecorationArgs) =>
  Decoration.widget(pos, () => {
    const domSerializer = DOMSerializer.fromSchema(proseMirrorSchema);
    const docFragment = domSerializer.serializeNode(node);

    if (node.isInline) {
      return createDeletedInlineElement(decorationClasses)(docFragment);
    }

    return createDeletedBlockElement(decorationClasses)(docFragment);
  });

const createDeletedInlineElement =
  (decorationClasses: DiffDecorationClasses) => (docFragment: DOMNode) => {
    const element = document.createElement('span');
    element.className = decorationClasses.delete;
    element.appendChild(docFragment);
    return element;
  };

const createDeletedBlockElement =
  (decorationClasses: DiffDecorationClasses) => (docFragment: DOMNode) => {
    const element = document.createElement('div');
    element.appendChild(docFragment);

    const getTextNodes = (node: DOMNode): DOMText[] =>
      [...node.childNodes].flatMap(
        (child) =>
          child.nodeType === globalThis.Node.TEXT_NODE &&
          child.nodeValue?.trim()
            ? [child as DOMText] // Type assertion since we check `nodeType`
            : getTextNodes(child) // Recursively get all text nodes
      );

    const wrapNode = (textNode: Text): void => {
      const span = document.createElement('span');
      span.className = decorationClasses.delete;
      span.textContent = textNode.nodeValue;
      textNode.replaceWith(span);
    };

    getTextNodes(element).forEach(wrapNode);

    return element;
  };
