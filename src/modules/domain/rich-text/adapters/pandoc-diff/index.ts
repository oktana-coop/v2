import { Node, type Schema } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';

import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
import {
  type HSLibOutput,
  isHSLibFailureOutput,
  representationToCliArg,
} from '../../hs-lib-cli';
import { type Diff } from '../../ports/diff';
import {
  createInlineDecoration,
  createNodeDecoration,
  createWidgetDeleteDecoration,
  pmDocFromJSONString,
} from '../../prosemirror';
import {
  type DiffDecoration,
  type InlineDiffDecoration,
  type NodeDiffDecoration,
  type PMNode,
  type WidgetDiffDecoration,
} from '../../prosemirror/hs-lib';

type HSLibDiffData = {
  doc: PMNode;
  decorations: DiffDecoration[];
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
  transformImageSrc: (src: string) => string;
};

const toWidgetDeleteDecoration =
  ({ proseMirrorSchema, transformImageSrc }: ToWidgetDecorationDeps) =>
  (decoration: WidgetDiffDecoration): Decoration => {
    const node = Node.fromJSON(proseMirrorSchema, decoration.node);

    return createWidgetDeleteDecoration({
      pos: decoration.pos,
      node,
      proseMirrorSchema,
      transformImageSrc,
    });
  };

export const createAdapter = ({
  runWasiCLIOutputingText,
}: {
  runWasiCLIOutputingText: Wasm['runWasiCLIOutputingText'];
}): Diff => {
  const proseMirrorDiff: Diff['proseMirrorDiff'] = async ({
    representation,
    proseMirrorSchema,
    docBefore,
    docAfter,
    transformImageSrc,
  }) => {
    const output = await runWasiCLIOutputingText({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'proseMirrorDiff',
        '--from',
        representationToCliArg(representation),
        '--',
        docBefore,
        docAfter,
      ],
    });

    // TODO: Perform proper validation & handle error cases
    const parsedOutput = JSON.parse(output) as HSLibOutput<HSLibDiffData>;

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
            transformImageSrc,
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
