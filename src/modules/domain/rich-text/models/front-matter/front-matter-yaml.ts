import * as Either from 'effect/Either';
import {
  type Document,
  isMap,
  isScalar,
  isSeq,
  type Pair,
  parseDocument,
  Scalar,
  type YAMLMap,
  YAMLSeq,
} from 'yaml';

import { InvalidMetadataError } from '../../errors';
import { type MetadataEntry, type MetadataValue } from './metadata';

type MetadataResult<T> = Either.Either<T, InvalidMetadataError>;

// The front matter as a YAML document holding a map of keys to values, or no contents for empty text.
export const parseFrontMatterYaml = (
  frontMatter: string
): MetadataResult<Document.Parsed> => {
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

const isBooleanScalar = (scalar: Scalar<string>): boolean =>
  scalar.type === Scalar.PLAIN &&
  (scalar.value === 'true' || scalar.value === 'false');

// A string ending in a newline reads as blocks.
const endsInNewline = (text: string): boolean => /\n[ \t]*$/.test(text);

export const scalarToMetadataValue = (
  scalar: Scalar<string>
): MetadataValue => {
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

// A map's entries, in the order it holds them.
export const toMetadataEntries = (
  map: YAMLMap<unknown, unknown>
): MetadataResult<MetadataEntry[]> =>
  Either.all(map.items.map(toMetadataEntry));

// The value the document holds for a key; undefined when it holds none.
export const valueAt = ({
  document,
  key,
}: {
  document: Document.Parsed;
  key: string;
}): MetadataResult<MetadataValue | undefined> => {
  const node = document.get(key, true);

  return node === undefined ? Either.right(undefined) : toMetadataValue(node);
};

const scalarOf = ({
  value,
  type,
}: {
  value: string;
  type: Scalar.Type;
}): Scalar<string> => {
  const scalar = new Scalar(value);
  scalar.type = type;
  return scalar;
};

// `true` or `false` unquoted, as a string: the failsafe schema can't write booleans.
export const booleanScalar = (value: boolean): Scalar<string> =>
  scalarOf({ value: String(value), type: Scalar.PLAIN });

// Quoted, so that no YAML reader takes the text for a boolean, a null or a number.
export const inlinesScalar = (source: string): Scalar<string> =>
  scalarOf({ value: source, type: Scalar.QUOTE_DOUBLE });

// A literal block, which keeps the text's lines and its final newline.
export const blocksScalar = (source: string): Scalar<string> =>
  scalarOf({ value: source, type: Scalar.BLOCK_LITERAL });

// The text ending in a newline, so that it reads as blocks.
export const withFinalNewline = (text: string): string =>
  endsInNewline(text) ? text : `${text}\n`;

export const listOf = (source: string): YAMLSeq<Scalar<string>> => {
  const list = new YAMLSeq<Scalar<string>>();
  list.add(inlinesScalar(source));
  return list;
};
