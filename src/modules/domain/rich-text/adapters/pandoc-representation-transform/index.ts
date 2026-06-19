import * as Effect from 'effect/Effect';

import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
import {
  binaryRichTextRepresentations,
  richTextRepresentations,
} from '../../constants/representations';
import {
  type HSLibOutput,
  isHSLibFailureOutput,
  representationToCliArg,
} from '../../hs-lib-cli';
import { type PdfEngine } from '../../ports/pdf-engine';
import {
  type RepresentationTransform,
  type RepresentationTransformAssetFile,
} from '../../ports/representation-transform';

// Pandoc resolves a document's relative asset refs within a virtual filesystem
// rooted at the project root, so the assets and the resource path are mounted at
// absolute paths in the WASI filesystem (`/` is the project root).
const toWasiFsPath = (path: string): string => `/${path}`;

const toWasiFsFiles = (
  assetFiles: ReadonlyArray<RepresentationTransformAssetFile> | undefined
) =>
  assetFiles?.map(({ relativePath, bytes }) => ({
    path: toWasiFsPath(relativePath),
    bytes,
  }));

// A root-level document's resource path is the empty string (the project root),
// which must still be passed as `/`, so check with `undefined`, not truthiness.
const resourcePathArgs = (resourcePath: string | undefined): string[] =>
  resourcePath !== undefined
    ? ['--resource-path', toWasiFsPath(resourcePath)]
    : [];

export const createAdapter = ({
  runWasiCLIOutputingText,
  runWasiCLIOutputingBinary,
  pdfEngine,
}: {
  runWasiCLIOutputingText: Wasm['runWasiCLIOutputingText'];
  runWasiCLIOutputingBinary: Wasm['runWasiCLIOutputingBinary'];
  pdfEngine: PdfEngine;
}): RepresentationTransform => {
  const transformToText: RepresentationTransform['transformToText'] = async ({
    from,
    to,
    input,
    assetFiles,
    resourcePath,
  }) => {
    if (input === '') {
      return '';
    }

    const output = await runWasiCLIOutputingText({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'convertToText',
        '--from',
        representationToCliArg(from),
        '--to',
        representationToCliArg(to),
        ...resourcePathArgs(resourcePath),
        '--',
        input,
      ],
      files: toWasiFsFiles(assetFiles),
    });

    if (!output) {
      throw new Error('Conversion failed: No output returned');
    }

    // TODO: Perform proper validation & handle error cases
    const parsedOutput = JSON.parse(output) as HSLibOutput<string>;

    if (isHSLibFailureOutput(parsedOutput)) {
      throw new Error(
        `Conversion failed: ${parsedOutput.errors.map((error) => error.message).join(', ')}`
      );
    }

    return parsedOutput.data;
  };

  const transformToBinary: RepresentationTransform['transformToBinary'] =
    async ({ from, to, input, stylesheet, assetFiles, resourcePath }) => {
      if (to === binaryRichTextRepresentations.PDF) {
        const html = await transformToText({
          from,
          to: richTextRepresentations.HTML,
          input,
          assetFiles,
          resourcePath,
        });
        return Effect.runPromise(pdfEngine.printToPdf({ html, stylesheet }));
      }

      const output = await runWasiCLIOutputingBinary({
        type: cliTypes.HS_LIB,
        args: [
          'v2-hs-lib',
          'convertToBinary',
          '--from',
          representationToCliArg(from),
          '--to',
          representationToCliArg(to),
          ...resourcePathArgs(resourcePath),
          '--',
          input,
        ],
        files: toWasiFsFiles(assetFiles),
      });

      return output;
    };

  return {
    transformToText,
    transformToBinary,
  };
};
