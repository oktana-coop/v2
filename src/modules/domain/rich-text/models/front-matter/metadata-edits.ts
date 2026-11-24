import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import { Scalar } from 'yaml';

import { type InvalidMetadataError } from '../../errors';
import { parseFrontMatterYaml } from './front-matter-yaml';

export type MetadataEdit = { type: 'setBoolean'; key: string; value: boolean };

// `true` or `false` unquoted, as a string: the failsafe schema can't write booleans.
const booleanScalar = (value: boolean): Scalar<string> => {
  const scalar = new Scalar(String(value));
  scalar.type = Scalar.PLAIN;
  return scalar;
};

export const applyMetadataEdit = ({
  frontMatter,
  edit,
}: {
  frontMatter: string | null;
  edit: MetadataEdit;
}): Either.Either<string, InvalidMetadataError> =>
  pipe(
    parseFrontMatterYaml(frontMatter ?? ''),
    Either.map((document) => {
      switch (edit.type) {
        case 'setBoolean':
          document.set(edit.key, booleanScalar(edit.value));
          return document.toString();
      }
    })
  );
