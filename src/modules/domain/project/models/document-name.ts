import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { z } from 'zod';

import {
  FilesystemValidationErrorTag,
  parseEntryNameEffect,
} from '../../../infrastructure/filesystem';
import {
  getDefaultRichTextRepresentationExtension,
  PRIMARY_RICH_TEXT_REPRESENTATION,
} from '../../rich-text';
import { ValidationError } from '../errors';

const documentNameSchema = z
  .string()
  .refine(
    (name) => !name.startsWith('.'),
    'A document name cannot start with a dot'
  );

export const parseDocumentNameEffect = (
  name: string
): Effect.Effect<string, ValidationError, never> =>
  pipe(
    parseEntryNameEffect(name),
    Effect.catchTag(FilesystemValidationErrorTag, (err) =>
      Effect.fail(new ValidationError(err.message))
    ),
    Effect.flatMap((entryName) => {
      const result = documentNameSchema.safeParse(entryName);

      return result.success
        ? Effect.succeed(result.data)
        : Effect.fail(new ValidationError(result.error.issues[0].message));
    })
  );

const UNTITLED = 'Untitled';

// `Untitled.md`, or `Untitled 2.md` and so on when a name in the directory
// already takes it.
export const getNewDocumentName = ({
  namesInDirectory,
}: {
  namesInDirectory: string[];
}): string => {
  const extension = getDefaultRichTextRepresentationExtension(
    PRIMARY_RICH_TEXT_REPRESENTATION
  );
  const takenNames = new Set(
    namesInDirectory.map((name) => name.toLowerCase())
  );
  const nameWithNumber = (number: number) =>
    number === 1
      ? `${UNTITLED}.${extension}`
      : `${UNTITLED} ${number}.${extension}`;

  // Names are compared ignoring case, as macOS and Windows do.
  const findFreeName = (number: number): string =>
    takenNames.has(nameWithNumber(number).toLowerCase())
      ? findFreeName(number + 1)
      : nameWithNumber(number);

  return findFreeName(1);
};
