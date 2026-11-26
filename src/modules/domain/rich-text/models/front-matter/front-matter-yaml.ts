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

export type FrontMatterYaml = Document.Parsed;

// The front matter as a YAML document holding a map of keys to values, or no contents for empty text.
export const parseFrontMatterYaml = (
  frontMatter: string
): MetadataResult<FrontMatterYaml> => {
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

export const toFrontMatter = (document: FrontMatterYaml): string =>
  document.toString();

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

const toMetadataEntries = (
  map: YAMLMap<unknown, unknown>
): MetadataResult<MetadataEntry[]> =>
  Either.all(map.items.map(toMetadataEntry));

export const valueAt = ({
  document,
  key,
}: {
  document: FrontMatterYaml;
  key: string;
}): MetadataResult<MetadataValue | undefined> => {
  const node = document.get(key, true);

  return node === undefined ? Either.right(undefined) : toMetadataValue(node);
};

export const entriesOf = (
  document: FrontMatterYaml
): MetadataResult<MetadataEntry[]> =>
  isMap(document.contents)
    ? toMetadataEntries(document.contents)
    : Either.right([]);

export const keysOf = (document: FrontMatterYaml): string[] =>
  isMap(document.contents)
    ? document.contents.items.flatMap(({ key }) =>
        isScalar<string>(key) ? [key.value] : []
      )
    : [];

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
const booleanScalar = (value: boolean): Scalar<string> =>
  scalarOf({ value: String(value), type: Scalar.PLAIN });

// Quoted, so that no YAML reader takes the text for a boolean, a null or a number.
const inlinesScalar = (source: string): Scalar<string> =>
  scalarOf({ value: source, type: Scalar.QUOTE_DOUBLE });

// A literal block, which keeps the text's lines and its final newline.
const blocksScalar = (source: string): Scalar<string> =>
  scalarOf({ value: source, type: Scalar.BLOCK_LITERAL });

// The text ending in a newline, so that it reads as blocks.
export const withFinalNewline = (text: string): string =>
  endsInNewline(text) ? text : `${text}\n`;

const listOf = (items: string[]): YAMLSeq<Scalar<string>> => {
  const list = new YAMLSeq<Scalar<string>>();
  items.forEach((item) => list.add(inlinesScalar(item)));
  return list;
};

export const setBoolean = ({
  document,
  key,
  value,
}: {
  document: FrontMatterYaml;
  key: string;
  value: boolean;
}): void => {
  document.set(key, booleanScalar(value));
};

export const setInlines = ({
  document,
  key,
  source,
}: {
  document: FrontMatterYaml;
  key: string;
  source: string;
}): void => {
  document.set(key, inlinesScalar(source));
};

// Adds the key right below `after`; last when `after` is null or missing.
export const insertInlines = ({
  document,
  key,
  source,
  after,
}: {
  document: FrontMatterYaml;
  key: string;
  source: string;
  after: string | null;
}): void => {
  document.set(key, inlinesScalar(source));

  if (after === null || !isMap(document.contents)) {
    return;
  }

  const { items } = document.contents;
  const index = items.findIndex(
    (pair) => isScalar(pair.key) && pair.key.value === after
  );

  if (index !== -1) {
    const added = items.splice(-1);
    items.splice(index + 1, 0, ...added);
  }
};

export const setBlocks = ({
  document,
  key,
  source,
}: {
  document: FrontMatterYaml;
  key: string;
  source: string;
}): void => {
  document.set(key, blocksScalar(withFinalNewline(source)));
};

export const setList = ({
  document,
  key,
  items,
}: {
  document: FrontMatterYaml;
  key: string;
  items: string[];
}): void => {
  document.set(key, listOf(items));
};

export const appendListItem = ({
  document,
  key,
  item,
}: {
  document: FrontMatterYaml;
  key: string;
  item: string;
}): void => {
  const list = document.get(key, true);

  if (isSeq(list)) {
    list.add(inlinesScalar(item));
  }
};

export const removeListItemAt = ({
  document,
  key,
  index,
}: {
  document: FrontMatterYaml;
  key: string;
  index: number;
}): void => {
  const list = document.get(key, true);

  if (isSeq(list)) {
    list.delete(index);
  }
};

export const renameKey = ({
  document,
  key,
  newKey,
}: {
  document: FrontMatterYaml;
  key: string;
  newKey: string;
}): void => {
  const keyNode = isMap(document.contents)
    ? document.contents.items
        .map((pair) => pair.key)
        .find((node) => isScalar(node) && node.value === key)
    : undefined;

  if (isScalar(keyNode)) {
    keyNode.value = newKey;
    keyNode.type = Scalar.QUOTE_DOUBLE;
  }
};

export const removeKey = ({
  document,
  key,
}: {
  document: FrontMatterYaml;
  key: string;
}): void => {
  document.delete(key);
};
