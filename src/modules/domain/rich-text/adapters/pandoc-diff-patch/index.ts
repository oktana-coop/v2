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
import {
  getDocumentRichTextContent,
  richTextRepresentations,
} from '../../models';
import { type DiffPatch } from '../../ports/diff-patch';
import {
  createInlineDecoration,
  createNodeDecoration,
  createWidgetDeleteDecoration,
  pmDocFromJSONString,
  pmDocToJSONString,
  pmStepFromJSON,
} from '../../prosemirror';
import {
  type DiffDecoration,
  type InlineDiffDecoration,
  type NodeDiffDecoration,
  type PMNode,
  type PMStep,
  type WidgetDiffDecoration,
} from '../../prosemirror/hs-lib';

type HSLibDiffData = {
  doc: PMNode;
  decorations: DiffDecoration[];
};

type HSLibStepsData = {
  doc: PMNode;
  steps: PMStep[];
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
}): DiffPatch => {
  const proseMirrorDiff: DiffPatch['proseMirrorDiff'] = async ({
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

  const proseMirrorSteps: DiffPatch['proseMirrorSteps'] = async ({
    pmDocBefore,
    docAfter,
    proseMirrorSchema,
  }) => {
    const output = await runWasiCLIOutputingText({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'proseMirrorSteps',
        '--before-format',
        representationToCliArg(richTextRepresentations.PROSEMIRROR),
        '--after-format',
        representationToCliArg(docAfter.representation),
        '--',
        pmDocToJSONString(pmDocBefore),
        getDocumentRichTextContent(docAfter),
      ],
    });

    const parsedOutput = JSON.parse(output) as HSLibOutput<HSLibStepsData>;

    if (isHSLibFailureOutput(parsedOutput)) {
      throw new Error(
        `Steps failed: ${parsedOutput.errors.map((error) => error.message).join(', ')}`
      );
    }

    const steps = parsedOutput.data.steps.map((step) =>
      pmStepFromJSON(step, proseMirrorSchema)
    );

    return {
      pmDocAfter: pmDocFromJSONString(parsedOutput.data.doc, proseMirrorSchema),
      steps,
    };
  };

  return {
    proseMirrorDiff,
    proseMirrorSteps,
  };
};
