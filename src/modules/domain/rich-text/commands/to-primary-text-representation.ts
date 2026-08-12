import * as Effect from 'effect/Effect';

import { mapErrorTo } from '../../../../utils/errors';
import { RepresentationTransformError } from '../errors';
import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
} from '../models';
import { type RepresentationTransform } from '../ports';

export type ToPrimaryTextRepresentationDeps = {
  transformToText: RepresentationTransform['transformToText'];
};

// The document's content in the primary text representation, transformed only
// when it is not already in it.
export const toPrimaryTextRepresentation =
  ({ transformToText }: ToPrimaryTextRepresentationDeps) =>
  (
    document: RichTextDocument
  ): Effect.Effect<string, RepresentationTransformError> =>
    document.representation === PRIMARY_RICH_TEXT_REPRESENTATION
      ? Effect.succeed(document.content)
      : Effect.tryPromise({
          try: () =>
            transformToText({
              from: document.representation,
              to: PRIMARY_RICH_TEXT_REPRESENTATION,
              input: document.content,
            }),
          catch: mapErrorTo(
            RepresentationTransformError,
            'Rich text representation transformation error'
          ),
        });
