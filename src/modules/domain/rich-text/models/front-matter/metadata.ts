import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import { isMap, isScalar, isSeq, type Pair, Scalar, type YAMLMap } from 'yaml';

import { InvalidMetadataError } from '../../errors';
import { parseFrontMatterYaml } from './front-matter-yaml';

export type MetadataEntry = { key: string; value: MetadataValue };

export type MetadataValue =
  | { type: 'MetaMap'; entries: MetadataEntry[] }
  | { type: 'MetaList'; items: MetadataValue[] }
  | { type: 'MetaBool'; value: boolean }
  | { type: 'MetaInlines' | 'MetaBlocks'; source: string };

type MetadataResult<T> = Either.Either<T, InvalidMetadataError>;

const isBooleanScalar = (scalar: Scalar<string>): boolean =>
  scalar.type === Scalar.PLAIN &&
  (scalar.value === 'true' || scalar.value === 'false');

// Pandoc reads a string ending in a newline as blocks.
const endsInNewline = (text: string): boolean => /\n[ \t]*$/.test(text);

const scalarToMetadataValue = (scalar: Scalar<string>): MetadataValue => {
  if (isBooleanScalar(scalar)) {
    return { type: 'MetaBool', value: scalar.value === 'true' };
  }

  return endsInNewline(scalar.value)
    ? { type: 'MetaBlocks', source: scalar.value }
    : { type: 'MetaInlines', source: scalar.value };
};

const toMetadataValue = (node: unknown): MetadataResult<MetadataValue> => {
  if (isMap(node)) {
    return Either.map(toMetadataEntries(node), (entries) => ({
      type: 'MetaMap',
      entries,
    }));
  }

  if (isSeq(node)) {
    return Either.map(Either.all(node.items.map(toMetadataValue)), (items) => ({
      type: 'MetaList',
      items,
    }));
  }

  if (isScalar<string>(node)) {
    return Either.right(scalarToMetadataValue(node));
  }

  return Either.left(
    new InvalidMetadataError(
      'The front matter has a value that is not a map, a list or a scalar.'
    )
  );
};

const toMetadataEntry = ({
  key,
  value,
}: Pair<unknown, unknown>): MetadataResult<MetadataEntry> =>
  isScalar<string>(key)
    ? Either.map(toMetadataValue(value), (metadataValue) => ({
        key: key.value,
        value: metadataValue,
      }))
    : Either.left(
        new InvalidMetadataError('The front matter has a key that is not text.')
      );

const toMetadataEntries = (
  map: YAMLMap<unknown, unknown>
): MetadataResult<MetadataEntry[]> =>
  Either.all(map.items.map(toMetadataEntry));

// Entries in the order the front matter holds them.
export const parseFrontMatter = (
  frontMatter: string
): MetadataResult<MetadataEntry[]> =>
  pipe(
    parseFrontMatterYaml(frontMatter),
    Either.flatMap(({ contents }) =>
      isMap(contents) ? toMetadataEntries(contents) : Either.right([])
    )
  );
