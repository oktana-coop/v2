import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import { type Document, isSeq } from 'yaml';

import { mergeText } from '../../../plain-text/codemirror';
import { type InvalidMetadataError } from '../../errors';
import {
  blocksScalar,
  booleanScalar,
  inlinesScalar,
  listOf,
  parseFrontMatterYaml,
  valueAt,
  withFinalNewline,
} from './front-matter-yaml';
import { type MetadataValue } from './metadata';

export type MetadataEdit =
  | { type: 'setBoolean'; key: string; value: boolean }
  // `base` is the text the edit started from.
  | {
      type: 'setInlines' | 'setBlocks';
      key: string;
      base: string;
      value: string;
    }
  | { type: 'addListItem' | 'removeListItem'; key: string; item: string };

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
  document: Document.Parsed;
  current: MetadataValue | undefined;
  edit: MetadataEdit;
}): void => {
  switch (edit.type) {
    case 'setBoolean':
      document.set(edit.key, booleanScalar(edit.value));
      return;
    case 'setInlines':
      document.set(
        edit.key,
        inlinesScalar(
          mergedText({
            current,
            type: 'MetaInlines',
            base: edit.base,
            value: edit.value,
          })
        )
      );
      return;
    case 'setBlocks':
      document.set(
        edit.key,
        blocksScalar(
          withFinalNewline(
            mergedText({
              current,
              type: 'MetaBlocks',
              base: withFinalNewline(edit.base),
              value: withFinalNewline(edit.value),
            })
          )
        )
      );
      return;
    case 'addListItem': {
      const list = document.get(edit.key, true);

      if (current?.type === 'MetaList' && isSeq(list)) {
        list.add(inlinesScalar(edit.item));
        return;
      }

      document.set(edit.key, listOf(edit.item));
      return;
    }
    case 'removeListItem': {
      const list = document.get(edit.key, true);
      const index =
        current?.type === 'MetaList'
          ? current.items.findIndex(
              (value) =>
                value.type === 'MetaInlines' && value.source === edit.item
            )
          : -1;

      if (isSeq(list) && index !== -1) {
        list.delete(index);
      }
      return;
    }
  }
};

// The front matter with the edit applied; a key the edit sets is added if missing.
export const applyMetadataEdit = ({
  frontMatter,
  edit,
}: {
  frontMatter: string | null;
  edit: MetadataEdit;
}): Either.Either<string, InvalidMetadataError> =>
  pipe(
    parseFrontMatterYaml(frontMatter ?? ''),
    Either.flatMap((document) =>
      pipe(
        valueAt({ document, key: edit.key }),
        Either.map((current) => {
          applyEdit({ document, current, edit });
          return document.toString();
        })
      )
    )
  );
