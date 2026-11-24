import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import { isMap } from 'yaml';

import { type InvalidMetadataError } from '../../errors';
import { parseFrontMatterYaml, toMetadataEntries } from './front-matter-yaml';

export type MetadataEntry = { key: string; value: MetadataValue };

export type MetadataValue =
  | { type: 'MetaMap'; entries: MetadataEntry[] }
  | { type: 'MetaList'; items: MetadataValue[] }
  | { type: 'MetaBool'; value: boolean }
  | { type: 'MetaInlines' | 'MetaBlocks'; source: string };

// Entries in the order the front matter holds them.
export const parseFrontMatter = (
  frontMatter: string
): Either.Either<MetadataEntry[], InvalidMetadataError> =>
  pipe(
    parseFrontMatterYaml(frontMatter),
    Either.flatMap(({ contents }) =>
      isMap(contents) ? toMetadataEntries(contents) : Either.right([])
    )
  );
