import { type MetadataValue } from '../../../../../modules/domain/rich-text';

type InlinesValue = { type: 'MetaInlines'; source: string };

const isInlines = (value: MetadataValue): value is InlinesValue =>
  value.type === 'MetaInlines';

// The items' text when they're all one-line text; null otherwise.
export const textListItems = (items: MetadataValue[]): string[] | null =>
  items.every(isInlines) ? items.map((item) => item.source) : null;
