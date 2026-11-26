import * as Either from 'effect/Either';
import {
  forwardRef,
  type KeyboardEventHandler,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

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
import { FunctionalityConfigContext } from '../../../../../modules/personalization/browser';
import { type KeyBindings, useKeyBindingMatcher } from '../../../keyboard';
import { Text } from '../../typography/Text';
import {
  type MetadataDiffRow,
  toMetadataDiffRows,
} from './diff/metadata-diff-rows';
import { MetadataDiffRows } from './diff/MetadataDiffRows';
import { MetadataForm } from './form/MetadataForm';
import { type FormPanel, FormPanelContext } from './form-panel';
import { MetadataEntries } from './MetadataEntries';
import { MetadataPanelModeToggle } from './MetadataPanelModeToggle';
import { useEditorFrontMatter } from './use-editor-front-matter';
import { FrontMatterEditor } from './yaml/FrontMatterEditor';
import { FrontMatterView } from './yaml/FrontMatterView';

const {
  clearFrontMatterEditFailure,
  clearMetadataEditFailure,
  editFrontMatter,
  editMetadata,
  getFrontMatterEditFailure,
  getMetadataEditFailures,
  hasMetadataEditingPlugin,
  redoMetadataEdit,
  undoMetadataEdit,
} = prosemirror;

export type MetadataPanelDiff = {
  frontMatterBefore: string | null;
  // Null when either version's front matter can't be read.
  metadataDiff: MetadataKeyDiff[] | null;
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
  const metadataDiff = diff?.metadataDiff ?? null;

  if (!diff || metadataDiff === null) {
    return Either.map(after, (entries) => ({ type: 'entries', entries }));
  }

  return Either.map(
    Either.all([parseOrEmpty(diff.frontMatterBefore), after]),
    ([beforeEntries, afterEntries]) => ({
      type: 'diffRows',
      rows: toMetadataDiffRows({
        before: beforeEntries,
        after: afterEntries,
        metadataDiff,
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
const MetadataSection = forwardRef<
  HTMLElement,
  {
    children: ReactNode;
    modeToggle?: ReactNode;
    tabIndex?: number;
    onKeyDown?: KeyboardEventHandler<HTMLElement>;
  }
>(function MetadataSection({ children, modeToggle, ...sectionProps }, ref) {
  return (
    <section
      ref={ref}
      aria-label="Properties"
      className="px-4 pt-4 text-left focus:outline-none"
      {...sectionProps}
    >
      <div className="flex items-start gap-2 border-b border-zinc-950/5 pb-4 dark:border-white/5">
        <div className="min-w-0 flex-1">{children}</div>
        {modeToggle}
      </div>
    </section>
  );
});

// Front matter the panel can't show; the reason goes to the console.
const UnreadableMetadata = ({ error }: { error: InvalidMetadataError }) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <Text>The properties can't be shown as a form.</Text>;
};

export const MetadataPanel = ({
  frontMatter,
  diff = null,
}: {
  frontMatter: string | null;
  // The before version and the diff, to mark what changed.
  diff?: MetadataPanelDiff | null;
}) => {
  const { showMetadataAsYaml, setShowMetadataAsYaml } = useContext(
    FunctionalityConfigContext
  );
  const content = useMemo(
    () => toPanelContent({ frontMatter, diff }),
    [frontMatter, diff]
  );

  const yamlView =
    frontMatter === null && diff === null ? (
      noProperties
    ) : (
      <FrontMatterView
        frontMatter={frontMatter}
        diffBase={diff ? (diff.frontMatterBefore ?? '') : null}
      />
    );

  return (
    <MetadataSection
      modeToggle={
        <MetadataPanelModeToggle
          isEditable={false}
          showYaml={showMetadataAsYaml}
          onShowYamlChange={setShowMetadataAsYaml}
        />
      }
    >
      {showMetadataAsYaml
        ? yamlView
        : Either.match(content, {
            onLeft: (error) => <UnreadableMetadata error={error} />,
            onRight: (panelContent) => <ContentView content={panelContent} />,
          })}
    </MetadataSection>
  );
};

const MetadataFormContent = ({
  frontMatter,
  ...formProps
}: {
  frontMatter: string | null;
  failures: prosemirror.MetadataEditFailures;
  onEdit: (edit: MetadataEdit) => void;
  onClearFailure: (key: string) => void;
}) => {
  const entries = useMemo(() => parseOrEmpty(frontMatter), [frontMatter]);

  return Either.match(entries, {
    onLeft: (error) => <UnreadableMetadata error={error} />,
    onRight: (formEntries) => (
      <MetadataForm entries={formEntries} {...formProps} />
    ),
  });
};

const EditableMetadataPanel = ({
  showYaml,
  onShowYamlChange,
  onUndo,
  onRedo,
  children,
}: {
  showYaml: boolean;
  onShowYamlChange: (showYaml: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  children: ReactNode;
}) => {
  const section = useRef<HTMLElement>(null);
  const matchKey = useKeyBindingMatcher();
  const editHistoryKeys: KeyBindings = showYaml
    ? {}
    : { 'ctrl+z': onUndo, 'ctrl+shift+z': onRedo, 'ctrl+y': onRedo };

  const focus = useCallback(() => {
    section.current?.focus();
  }, []);

  const panel: FormPanel = {
    focus,
    isEditHistoryKey: (event) =>
      matchKey({ keyBindings: editHistoryKeys, event }) !== null,
  };

  // Undo and redo leave the field that has the focus, for it to show the
  // document's value.
  const handleKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    const binding = matchKey({ keyBindings: editHistoryKeys, event });

    if (binding !== null) {
      event.preventDefault();
      focus();
      editHistoryKeys[binding]?.();
    }
  };

  return (
    <MetadataSection
      ref={section}
      modeToggle={
        <MetadataPanelModeToggle
          isEditable
          showYaml={showYaml}
          onShowYamlChange={onShowYamlChange}
        />
      }
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <FormPanelContext.Provider value={panel}>
        {children}
      </FormPanelContext.Provider>
    </MetadataSection>
  );
};

export const EditorMetadataPanel = () => {
  const { showMetadataAsYaml, setShowMetadataAsYaml } = useContext(
    FunctionalityConfigContext
  );
  const frontMatter = useEditorFrontMatter();
  const failures = useEditorState(getMetadataEditFailures);
  const frontMatterEditFailure = useEditorState(getFrontMatterEditFailure);
  const { view } = useContext(ProseMirrorContext);

  if (
    frontMatter === undefined ||
    failures === undefined ||
    frontMatterEditFailure === undefined
  ) {
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

  const handleEditFrontMatter = (edit: prosemirror.FrontMatterEdit) => {
    editFrontMatter(edit)(view.state, view.dispatch);
  };

  const handleClearFrontMatterEditFailure = () => {
    clearFrontMatterEditFailure(view.state, view.dispatch);
  };

  const handleUndo = () => {
    undoMetadataEdit(view.state, view.dispatch);
  };

  const handleRedo = () => {
    redoMetadataEdit(view.state, view.dispatch);
  };

  return (
    <EditableMetadataPanel
      showYaml={showMetadataAsYaml}
      onShowYamlChange={setShowMetadataAsYaml}
      onUndo={handleUndo}
      onRedo={handleRedo}
    >
      {showMetadataAsYaml ? (
        <FrontMatterEditor
          frontMatter={frontMatter}
          failure={frontMatterEditFailure}
          onEdit={handleEditFrontMatter}
          onClearFailure={handleClearFrontMatterEditFailure}
        />
      ) : (
        <MetadataFormContent
          frontMatter={frontMatter}
          failures={failures}
          onEdit={handleEdit}
          onClearFailure={handleClearFailure}
        />
      )}
    </EditableMetadataPanel>
  );
};
