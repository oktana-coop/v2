import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';

import { type InvalidMetadataError } from '../../errors';
import { entriesOf, parseFrontMatterYaml } from './front-matter-yaml';

export type MetadataEntry = { key: string; value: MetadataValue };

export type MetadataValue =
  | { type: 'MetaMap'; entries: MetadataEntry[] }
  | { type: 'MetaList'; items: MetadataValue[] }
  | { type: 'MetaBool'; value: boolean }
  | { type: 'MetaInlines' | 'MetaBlocks'; source: string };

type InlinesValue = { type: 'MetaInlines'; source: string };

const isInlines = (value: MetadataValue): value is InlinesValue =>
  value.type === 'MetaInlines';

// The items' text when they're all one-line text; null otherwise.
export const textListItems = (items: MetadataValue[]): string[] | null =>
  items.every(isInlines) ? items.map((item) => item.source) : null;

// Entries in the order the front matter holds them.
export const parseFrontMatter = (
  frontMatter: string
): Either.Either<MetadataEntry[], InvalidMetadataError> =>
  pipe(parseFrontMatterYaml(frontMatter), Either.flatMap(entriesOf));
