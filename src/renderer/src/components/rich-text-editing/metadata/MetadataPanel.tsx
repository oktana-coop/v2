import * as Either from 'effect/Either';
import { type ReactNode, useContext, useEffect, useMemo } from 'react';

import {
  type InvalidMetadataError,
  type MetadataEdit,
  type MetadataEntry,
  type MetadataKeyDiff,
  parseFrontMatter,
  prosemirror,
} from '../../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../../modules/domain/rich-text/react/prosemirror-context';
import { useEditorState } from '../../../../../modules/domain/rich-text/react/use-editor-state';
import { Text } from '../../typography/Text';
import {
  type MetadataDiffRow,
  toMetadataDiffRows,
} from './diff/metadata-diff-rows';
import { MetadataDiffRows } from './diff/MetadataDiffRows';
import { MetadataForm } from './form/MetadataForm';
import { MetadataEntries } from './MetadataEntries';
import { useEditorFrontMatter } from './use-editor-front-matter';

const {
  clearMetadataEditFailure,
  editMetadata,
  getMetadataEditFailures,
  hasMetadataEditingPlugin,
} = prosemirror;

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

// The panel around the metadata.
const MetadataSection = ({ children }: { children: ReactNode }) => (
  <section aria-label="Properties" className="px-4 pt-4 text-left">
    <div className="border-b border-zinc-950/5 pb-4 dark:border-white/5">
      {children}
    </div>
  </section>
);

// Front matter the panel can't show; the reason goes to the console.
const UnreadableMetadata = ({ error }: { error: InvalidMetadataError }) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <Text>The properties can't be shown here yet.</Text>;
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

  return (
    <MetadataSection>
      {Either.match(content, {
        onLeft: (error) => <UnreadableMetadata error={error} />,
        onRight: (panelContent) => <ContentView content={panelContent} />,
      })}
    </MetadataSection>
  );
};

const MetadataFormPanel = ({
  frontMatter,
  ...formProps
}: {
  frontMatter: string | null;
  failures: prosemirror.MetadataEditFailures;
  onEdit: (edit: MetadataEdit) => void;
  onClearFailure: (key: string) => void;
}) => {
  const entries = useMemo(() => parseOrEmpty(frontMatter), [frontMatter]);

  return (
    <MetadataSection>
      {Either.match(entries, {
        onLeft: (error) => <UnreadableMetadata error={error} />,
        onRight: (formEntries) => (
          <MetadataForm entries={formEntries} {...formProps} />
        ),
      })}
    </MetadataSection>
  );
};

export const EditorMetadataPanel = () => {
  const frontMatter = useEditorFrontMatter();
  const failures = useEditorState(getMetadataEditFailures);
  const { view } = useContext(ProseMirrorContext);

  if (frontMatter === undefined || failures === undefined) {
    return null;
  }

  // An editor without metadata editing shows the metadata as it is.
  if (!view || !hasMetadataEditingPlugin(view.state)) {
    return <MetadataPanel frontMatter={frontMatter} />;
  }

  const handleEdit = (edit: MetadataEdit) => {
    editMetadata(edit)(view.state, view.dispatch);
  };

  const handleClearFailure = (key: string) => {
    clearMetadataEditFailure(key)(view.state, view.dispatch);
  };

  return (
    <MetadataFormPanel
      frontMatter={frontMatter}
      failures={failures}
      onEdit={handleEdit}
      onClearFailure={handleClearFailure}
    />
  );
};
