import * as Either from 'effect/Either';
import { type Document, isMap, parseDocument } from 'yaml';

import { InvalidMetadataError } from '../../errors';

// The front matter as a YAML document holding a map of keys to values, or no contents for empty text.
export const parseFrontMatterYaml = (
  frontMatter: string
): Either.Either<Document.Parsed, InvalidMetadataError> => {
  const document = parseDocument(frontMatter, {
    schema: 'failsafe',
    prettyErrors: false,
  });
  const [error] = document.errors;

  if (error) {
    return Either.left(new InvalidMetadataError(error.message));
  }

  return document.contents === null || isMap(document.contents)
    ? Either.right(document)
    : Either.left(
        new InvalidMetadataError(
          'The front matter is not a map of keys to values.'
        )
      );
};
