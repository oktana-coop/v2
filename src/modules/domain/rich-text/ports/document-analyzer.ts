import * as Effect from 'effect/Effect';

import { type DocumentAnalysisError, type RichTextLibError } from '../errors';
import { type AssetDocRelPath, type RichTextRepresentation } from '../models';

export type ExtractLocalAssetReferencesArgs = {
  representation: RichTextRepresentation;
  content: string;
};

export type DocumentAnalyzer = {
  extractLocalAssetReferences: (
    args: ExtractLocalAssetReferencesArgs
  ) => Effect.Effect<
    AssetDocRelPath[],
    DocumentAnalysisError | RichTextLibError,
    never
  >;
};
