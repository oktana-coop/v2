import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';

import { mergeText } from '../../../plain-text';
import { type InvalidMetadataError } from '../../errors';
import { parseFrontMatterYaml } from './front-matter-yaml';

export const mergeFrontMatter = ({
  base,
  yours,
  theirs,
}: {
  base: string | null;
  yours: string | null;
  theirs: string | null;
}): Either.Either<string, InvalidMetadataError> =>
  pipe(
    mergeText({
      base: base ?? '',
      yours: yours ?? '',
      theirs: theirs ?? '',
    }),
    (merged) =>
      pipe(
        parseFrontMatterYaml(merged),
        Either.map(() => merged)
      )
  );
