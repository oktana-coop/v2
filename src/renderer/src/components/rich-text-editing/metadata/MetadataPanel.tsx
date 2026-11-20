import * as Either from 'effect/Either';
import { Fragment, useEffect, useMemo } from 'react';

import {
  type MetadataEntry,
  type MetadataValue,
  parseFrontMatter,
} from '../../../../../modules/domain/rich-text';
import { Badge } from '../../highlighting/Badge';
import { Checkbox } from '../../inputs/Checkbox';
import { Text } from '../../typography/Text';
import { useEditorFrontMatter } from './use-editor-front-matter';

type InlinesValue = { type: 'MetaInlines'; source: string };

const isInlines = (value: MetadataValue): value is InlinesValue =>
  value.type === 'MetaInlines';

const itemCount = (count: number): string =>
  count === 1 ? '1 item' : `${count} items`;

const ListValue = ({ items }: { items: MetadataValue[] }) => {
  if (!items.every(isInlines)) {
    return <span>{itemCount(items.length)}</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {items.map((item, index) => (
        <Badge key={index} color="zinc">
          {item.source}
        </Badge>
      ))}
    </span>
  );
};

const EntryValue = ({ entry }: { entry: MetadataEntry }) => {
  const { key, value } = entry;

  switch (value.type) {
    case 'MetaInlines':
      return <span>{value.source}</span>;
    case 'MetaBlocks':
      return (
        <span className="whitespace-pre-wrap">{value.source.trimEnd()}</span>
      );
    case 'MetaBool':
      return (
        <Checkbox
          checked={value.value}
          color="zinc"
          aria-label={key}
          aria-readonly
          className="pointer-events-none"
        />
      );
    case 'MetaList':
      return <ListValue items={value.items} />;
    case 'MetaMap':
      return <span>{value.entries.map((entry) => entry.key).join(', ')}</span>;
  }
};

const MetadataRows = ({ entries }: { entries: MetadataEntry[] }) => (
  <dl className="grid grid-cols-[fit-content(12rem)_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm/6">
    {entries.map((entry) => (
      <Fragment key={entry.key}>
        <dt className="truncate text-zinc-600 dark:text-zinc-300">
          {entry.key}
        </dt>
        <dd className="min-w-0 break-words text-zinc-950 dark:text-white">
          <EntryValue entry={entry} />
        </dd>
      </Fragment>
    ))}
  </dl>
);

export const MetadataPanel = ({
  frontMatter,
}: {
  frontMatter: string | null;
}) => {
  const metadata = useMemo(
    () =>
      frontMatter === null ? Either.right([]) : parseFrontMatter(frontMatter),
    [frontMatter]
  );

  useEffect(() => {
    if (Either.isLeft(metadata)) {
      console.error(metadata.left);
    }
  }, [metadata]);

  const content = Either.match(metadata, {
    onLeft: () => <Text>The properties can't be shown here yet.</Text>,
    onRight: (entries) =>
      entries.length === 0 ? (
        <Text>No properties</Text>
      ) : (
        <MetadataRows entries={entries} />
      ),
  });

  return (
    <section aria-label="Properties" className="px-4 pt-4 text-left">
      <div className="border-b border-zinc-950/5 pb-4 dark:border-white/5">
        {content}
      </div>
    </section>
  );
};

export const EditorMetadataPanel = () => {
  const frontMatter = useEditorFrontMatter();

  if (frontMatter === undefined) {
    return null;
  }

  return <MetadataPanel frontMatter={frontMatter} />;
};
