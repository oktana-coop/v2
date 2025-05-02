import { DOMSerializer, Node, type Schema } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { cliTypes, type Wasm } from '../../../wasm';
import { type Diff, type DiffDecorationClasses } from '../../ports/diff';
import { pmDocFromJSONString } from '../../prosemirror';
import {
  type DiffDecoration,
  type InlineDiffDecoration,
  type NodeDiffDecoration,
  type PMNode,
  type WidgetDiffDecoration,
} from '../../prosemirror/hs-lib';
import { representationToCliArg } from './cli-args';

type DOMNode = globalThis.Node;
type DOMText = globalThis.Text;

type HSLibDiffSuccessOutput = {
  data: {
    doc: PMNode;
    decorations: DiffDecoration[];
  };
};

type HSLibError = {
  message: string;
};

type HSLibFailureOutput = {
  errors: HSLibError[];
};

type HSLibDiffOutput = HSLibDiffSuccessOutput | HSLibFailureOutput;

const isHSLibFailureOutput = (
  output: HSLibDiffOutput
): output is HSLibFailureOutput => {
  return 'errors' in output;
};

const toInlineDecoration = (decoration: InlineDiffDecoration): Decoration =>
  Decoration.inline(decoration.from, decoration.to, {
    class: decoration.attrs.class,
  });

const toNodeDecoration = (decoration: NodeDiffDecoration): Decoration =>
  Decoration.node(decoration.from, decoration.to, {
    class: decoration.attrs.class,
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

type ToWidgetDecorationDeps = {
  proseMirrorSchema: Schema;
  decorationClasses: DiffDecorationClasses;
};

const toWidgetDeleteDecoration =
  ({ proseMirrorSchema, decorationClasses }: ToWidgetDecorationDeps) =>
  (decoration: WidgetDiffDecoration): Decoration =>
    Decoration.widget(decoration.pos, () => {
      const node = Node.fromJSON(proseMirrorSchema, decoration.node);
      const domSerializer = DOMSerializer.fromSchema(proseMirrorSchema);
      const docFragment = domSerializer.serializeNode(node);

      if (node.isInline) {
        return createDeletedInlineElement(decorationClasses)(docFragment);
      }

      return createDeletedBlockElement(decorationClasses)(docFragment);
    });

export const createAdapter = ({
  runWasiCLI,
}: {
  runWasiCLI: Wasm['runWasiCLI'];
}): Diff => {
  const proseMirrorDiff: Diff['proseMirrorDiff'] = async ({
    representation,
    proseMirrorSchema,
    decorationClasses,
    docBefore,
    docAfter,
  }) => {
    const output = await runWasiCLI({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'proseMirrorDiff',
        '--from',
        representationToCliArg(representation),
        docBefore,
        docAfter,
      ],
    });

    // TODO: Perform proper validation & handle error cases
    const parsedOutput = JSON.parse(output) as HSLibDiffOutput;

    if (isHSLibFailureOutput(parsedOutput)) {
      throw new Error(
        `Diff failed: ${parsedOutput.errors.map((error) => error.message).join(', ')}`
      );
    }

    const decorations = parsedOutput.data.decorations.map((decoration) => {
      switch (decoration.type) {
        case 'inline':
          return toInlineDecoration(decoration);
        case 'node':
          return toNodeDecoration(decoration);
        case 'widget':
          return toWidgetDeleteDecoration({
            proseMirrorSchema,
            decorationClasses,
          })(decoration);
      }
    });

    const pmDoc = pmDocFromJSONString(parsedOutput.data.doc, proseMirrorSchema);

    return {
      pmDocAfter: pmDoc,
      decorations: DecorationSet.create(pmDoc, decorations),
    };
  };

  return {
    proseMirrorDiff,
  };
};
