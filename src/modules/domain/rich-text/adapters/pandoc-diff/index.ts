import { Node, type Schema } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';

import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
import { type Diff } from '../../ports/diff';
import {
  createInlineDecoration,
  createNodeDecoration,
  createWidgetDeleteDecoration,
  type DiffDecorationClasses,
  pmDocFromJSONString,
} from '../../prosemirror';
import {
  type DiffDecoration,
  type InlineDiffDecoration,
  type NodeDiffDecoration,
  type PMNode,
  type WidgetDiffDecoration,
} from '../../prosemirror/hs-lib';
import { representationToCliArg } from './cli-args';

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

const toInlineDecoration = (decoration: InlineDiffDecoration): Decoration => {
  if (!decoration.attrs.class) {
    throw new Error('Inline decoration must have a CSS class');
  }

  return createInlineDecoration({
    from: decoration.from,
    to: decoration.to,
    className: decoration.attrs.class,
  });
};

const toNodeDecoration = (decoration: NodeDiffDecoration): Decoration => {
  if (!decoration.attrs.class) {
    throw new Error('Node decoration must have a CSS class');
  }

  return createNodeDecoration({
    from: decoration.from,
    to: decoration.to,
    className: decoration.attrs.class,
  });
};

type ToWidgetDecorationDeps = {
  proseMirrorSchema: Schema;
  decorationClasses: DiffDecorationClasses;
};

const toWidgetDeleteDecoration =
  ({ proseMirrorSchema, decorationClasses }: ToWidgetDecorationDeps) =>
  (decoration: WidgetDiffDecoration): Decoration => {
    const node = Node.fromJSON(proseMirrorSchema, decoration.node);

    return createWidgetDeleteDecoration({
      pos: decoration.pos,
      node,
      proseMirrorSchema,
      decorationClasses,
    });
  };

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
