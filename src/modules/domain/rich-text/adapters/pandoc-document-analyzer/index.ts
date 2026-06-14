import { getSomes } from 'effect/Array';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
import { mapErrorTo } from '../../../../../utils/errors';
import { DocumentAnalysisError } from '../../errors';
import {
  type HSLibOutput,
  isHSLibFailureOutput,
  representationToCliArg,
} from '../../hs-lib-cli';
import { parseAssetDocRelPathEffect } from '../../models';
import { type DocumentAnalyzer } from '../../ports/document-analyzer';

export const createAdapter = ({
  runWasiCLIOutputingText,
}: {
  runWasiCLIOutputingText: Wasm['runWasiCLIOutputingText'];
}): DocumentAnalyzer => {
  const extractLocalAssetReferences: DocumentAnalyzer['extractLocalAssetReferences'] =
    ({ representation, content }) => {
      if (content === '') {
        return Effect.succeed([]);
      }

      return pipe(
        Effect.tryPromise({
          try: () =>
            runWasiCLIOutputingText({
              type: cliTypes.HS_LIB,
              args: [
                'v2-hs-lib',
                'extractAssetUrls',
                '--format',
                representationToCliArg(representation),
                '--',
                content,
              ],
            }),
          catch: mapErrorTo(
            DocumentAnalysisError,
            'Failed to extract asset references'
          ),
        }),
        Effect.flatMap((output) =>
          Effect.try({
            try: () => JSON.parse(output) as HSLibOutput<string[]>,
            catch: mapErrorTo(
              DocumentAnalysisError,
              'Failed to parse asset extraction output'
            ),
          })
        ),
        Effect.flatMap((parsedOutput) =>
          isHSLibFailureOutput(parsedOutput)
            ? Effect.fail(
                new DocumentAnalysisError(
                  `Asset extraction failed: ${parsedOutput.errors.map((error) => error.message).join(', ')}`
                )
              )
            : Effect.succeed(parsedOutput.data)
        ),
        Effect.flatMap(
          Effect.forEach((url: string) =>
            // Keep only local references: external URLs (with a scheme) and
            // otherwise-invalid srcs fail to parse and are dropped.
            Effect.option(parseAssetDocRelPathEffect(url))
          )
        ),
        Effect.map(getSomes)
      );
    };

  return {
    extractLocalAssetReferences,
  };
};
