import * as Either from 'effect/Either';
import { useEffect, useMemo } from 'react';

import {
  type InvalidMetadataError,
  type MetadataEntry,
  type MetadataKeyDiff,
  parseFrontMatter,
} from '../../../../../modules/domain/rich-text';
import { Text } from '../../typography/Text';
import { type MetadataDiffRow, toMetadataDiffRows } from './metadata-diff-rows';
import { MetadataDiffRows } from './MetadataDiffRows';
import { MetadataEntries } from './MetadataEntries';
import { useEditorFrontMatter } from './use-editor-front-matter';

export type MetadataPanelDiff = {
  frontMatterBefore: string | null;
  metadataDiff: MetadataKeyDiff[];
};

type PanelContent =
  | { type: 'entries'; entries: MetadataEntry[] }
  | { type: 'diffRows'; rows: MetadataDiffRow[] };

const parseOrEmpty = (
  frontMatter: string | null
): Either.Either<MetadataEntry[], InvalidMetadataError> =>
  frontMatter === null ? Either.right([]) : parseFrontMatter(frontMatter);

const toPanelContent = ({
  frontMatter,
  diff,
}: {
  frontMatter: string | null;
  diff: MetadataPanelDiff | null;
}): Either.Either<PanelContent, InvalidMetadataError> => {
  const after = parseOrEmpty(frontMatter);

  if (!diff) {
    return Either.map(after, (entries) => ({ type: 'entries', entries }));
  }

  return Either.map(
    Either.all([parseOrEmpty(diff.frontMatterBefore), after]),
    ([beforeEntries, afterEntries]) => ({
      type: 'diffRows',
      rows: toMetadataDiffRows({
        before: beforeEntries,
        after: afterEntries,
        metadataDiff: diff.metadataDiff,
      }),
    })
  );
};

const noProperties = <Text>No properties</Text>;

const ContentView = ({ content }: { content: PanelContent }) => {
  switch (content.type) {
    case 'entries':
      return content.entries.length === 0 ? (
        noProperties
      ) : (
        <MetadataEntries entries={content.entries} />
      );
    case 'diffRows':
      return content.rows.length === 0 ? (
        noProperties
      ) : (
        <MetadataDiffRows rows={content.rows} />
      );
  }
};

export const MetadataPanel = ({
  frontMatter,
  diff = null,
}: {
  frontMatter: string | null;
  // The before version and the diff, to mark what changed.
  diff?: MetadataPanelDiff | null;
}) => {
  const content = useMemo(
    () => toPanelContent({ frontMatter, diff }),
    [frontMatter, diff]
  );

  useEffect(() => {
    if (Either.isLeft(content)) {
      console.error(content.left);
    }
  }, [content]);

  return (
    <section aria-label="Properties" className="px-4 pt-4 text-left">
      <div className="border-b border-zinc-950/5 pb-4 dark:border-white/5">
        {Either.match(content, {
          onLeft: () => <Text>The properties can't be shown here yet.</Text>,
          onRight: (panelContent) => <ContentView content={panelContent} />,
        })}
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
