import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';

import { mergeText } from '../../../plain-text/codemirror';
import {
  type InvalidMetadataError,
  InvalidMetadataKeyError,
} from '../../errors';
import {
  appendListItem,
  type FrontMatterYaml,
  insertInlines,
  keysOf,
  parseFrontMatterYaml,
  removeKey,
  removeListItemAt,
  renameKey,
  setBlocks,
  setBoolean,
  setInlines,
  setList,
  toFrontMatter,
  valueAt,
  withFinalNewline,
} from './front-matter-yaml';
import { type MetadataValue, textListItems } from './metadata';
import { invalidMetadataKeyReason } from './metadata-keys';

export type MetadataEdit =
  | { type: 'setBoolean'; key: string; value: boolean }
  // `base` is the text the edit started from.
  | {
      type: 'setInlines' | 'setBlocks';
      key: string;
      base: string;
      value: string;
    }
  | { type: 'addListItem' | 'removeListItem'; key: string; item: string }
  // One-line text to a list holding it, or a list of one-line text to its
  // items joined.
  | { type: 'changeToList' | 'changeToText'; key: string }
  // `after` is the key it goes below; null for after the others.
  | { type: 'addKey'; key: string; value: string; after: string | null }
  | { type: 'renameKey'; key: string; newKey: string }
  | { type: 'removeKey'; key: string };

type MetadataTextValue = Extract<
  MetadataValue,
  { type: 'MetaInlines' | 'MetaBlocks' }
>;

const isText = (value: MetadataValue): value is MetadataTextValue =>
  value.type === 'MetaInlines' || value.type === 'MetaBlocks';

// The edit's value merged with the current one; the edit's value alone when the
// current one is no longer text of that kind.
const mergedText = ({
  current,
  type,
  base,
  value,
}: {
  current: MetadataValue | undefined;
  type: MetadataTextValue['type'];
  base: string;
  value: string;
}): string =>
  current !== undefined && isText(current) && current.type === type
    ? mergeText({ base, yours: value, theirs: current.source })
    : value;

// Makes the edit on the YAML, given the value the front matter holds for its key.
const applyEdit = ({
  document,
  current,
  edit,
}: {
  document: FrontMatterYaml;
  current: MetadataValue | undefined;
  edit: MetadataEdit;
}): void => {
  switch (edit.type) {
    case 'setBoolean':
      setBoolean({ document, key: edit.key, value: edit.value });
      return;
    case 'setInlines':
      setInlines({
        document,
        key: edit.key,
        source: mergedText({
          current,
          type: 'MetaInlines',
          base: edit.base,
          value: edit.value,
        }),
      });
      return;
    case 'setBlocks':
      setBlocks({
        document,
        key: edit.key,
        source: mergedText({
          current,
          type: 'MetaBlocks',
          base: withFinalNewline(edit.base),
          value: withFinalNewline(edit.value),
        }),
      });
      return;
    case 'addListItem':
      if (current?.type === 'MetaList') {
        appendListItem({ document, key: edit.key, item: edit.item });
        return;
      }

      setList({ document, key: edit.key, items: [edit.item] });
      return;
    case 'removeListItem': {
      const index =
        current?.type === 'MetaList'
          ? current.items.findIndex(
              (value) =>
                value.type === 'MetaInlines' && value.source === edit.item
            )
          : -1;

      if (index !== -1) {
        removeListItemAt({ document, key: edit.key, index });
      }
      return;
    }
    case 'changeToList':
      if (current?.type === 'MetaInlines') {
        setList({ document, key: edit.key, items: [current.source] });
      }
      return;
    case 'changeToText': {
      const items =
        current?.type === 'MetaList' ? textListItems(current.items) : null;

      if (items !== null) {
        setInlines({ document, key: edit.key, source: items.join(', ') });
      }
      return;
    }
    case 'addKey':
      insertInlines({
        document,
        key: edit.key,
        source: edit.value,
        after: edit.after,
      });
      return;
    case 'renameKey':
      renameKey({ document, key: edit.key, newKey: edit.newKey });
      return;
    case 'removeKey':
      removeKey({ document, key: edit.key });
      return;
  }
};

// The key the edit gives a property: an added key, or a rename's new key while
// the renamed key is there. Null for an edit that gives none.
const newKeyOf = ({
  edit,
  existingKeys,
}: {
  edit: MetadataEdit;
  existingKeys: readonly string[];
}): string | null => {
  if (edit.type === 'addKey') {
    return edit.key;
  }

  return edit.type === 'renameKey' &&
    edit.newKey !== edit.key &&
    existingKeys.includes(edit.key)
    ? edit.newKey
    : null;
};

// Fails for an edit whose new key can't name a property.
const checkEdit = ({
  document,
  edit,
}: {
  document: FrontMatterYaml;
  edit: MetadataEdit;
}): Either.Either<FrontMatterYaml, InvalidMetadataKeyError> => {
  const existingKeys = keysOf(document);
  const newKey = newKeyOf({ edit, existingKeys });
  const reason =
    newKey === null
      ? null
      : invalidMetadataKeyReason({ key: newKey, existingKeys });

  return reason === null
    ? Either.right(document)
    : Either.left(
        new InvalidMetadataKeyError(
          `The key "${newKey}" can't name a property (${reason.type}).`,
          { reason }
        )
      );
};

// The front matter with the edit applied; a key the edit sets is added if missing.
export const applyMetadataEdit = ({
  frontMatter,
  edit,
}: {
  frontMatter: string | null;
  edit: MetadataEdit;
}): Either.Either<string, InvalidMetadataError | InvalidMetadataKeyError> =>
  pipe(
    parseFrontMatterYaml(frontMatter ?? ''),
    Either.flatMap((document) => checkEdit({ document, edit })),
    Either.flatMap((document) =>
      pipe(
        valueAt({ document, key: edit.key }),
        Either.map((current) => {
          applyEdit({ document, current, edit });
          return toFrontMatter(document);
        })
      )
    )
  );
