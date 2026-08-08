import { clsx } from 'clsx';
import {
  baseKeymap,
  chainCommands,
  setBlockType as setProsemirrorBlockType,
} from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { type Node, type Schema } from 'prosemirror-model';
import {
  type EditorState,
  type Plugin,
  type Selection,
  type Transaction,
} from 'prosemirror-state';
import { type EditorView } from 'prosemirror-view';
import { useCallback, useContext, useState } from 'react';

import {
  type BlockType,
  blockTypes,
  type ContainerBlockType,
  CURRENT_SCHEMA_VERSION,
  getDocumentRichTextContent,
  getHeadingLevel,
  type LeafBlockType,
  LinkAttrs,
  prosemirror,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../modules/domain/rich-text/react/prosemirror-context';
import { useKeyBindings } from '../../keyboard';
import { keyBindings } from '../../pages/project/shared/command-palette/key-bindings';
import { LongTextSkeleton } from '../progress/skeletons/LongText';
import { EditorToolbar } from './editor-toolbar';
import { FindBar } from './FindBar';
import { LinkDialog } from './LinkDialog';
import { LinkPopover } from './LinkPopover';
import { type EditorSeed, ProseMirrorEditor } from './ProseMirrorEditor';
import { useEditorSeed } from './use-editor-seed';

const {
  schema,
  buildInputRules,
  ensureTrailingParagraphInDoc,
  getCurrentLeafBlockType,
  getCurrentContainerBlockType,
  isMarkActive,
  toggleEm,
  toggleStrong,
  toggleCode,
  transactionUpdatesMarks,
  addLink,
  removeLink,
  updateLink,
  linkSelectionPlugin,
  selectionChangePlugin,
  getSelectedText,
  findLinkAtSelection,
  ensureTrailingParagraphPlugin,
  ensureTrailingSpaceAfterAtomPlugin,
  moveCursorToNextBlockOnInsertionPlugin,
  removeEmptyFiguresPlugin,
  wrapInList,
  wrapIn,
  splitListItem,
  liftListItem,
  sinkListItem,
  pasteMarkdownPlugin,
  markdownMarkPlugins,
  insertNote,
  notesPlugin,
  insertHorizontalRule,
  canInsertHorizontalRule,
  canInsertFigure,
  deleteFigureBeforeCursor,
  deleteFigureAfterCursor,
  moveToParagraphAfterSelectedFigure,
  pickAndInsertFigure,
  placeholderPlugin,
  assetsPlugin,
  diffPlugin,
  codeBlockHighlightPlugin,
  searchPlugin,
} = prosemirror;

export type SharedEditorProps = {
  isToolbarOpen?: boolean;
  pickAsset: prosemirror.FigureAssetPicker;
  resolveAssetSrc: prosemirror.ResolveAssetSrc;
};

// How the editor is bound to its content: the content as a ProseMirror
// document, as its domain value (the diff base), and the sync plugin that
// carries editor changes back.
export type ContentBinding = {
  pmDoc: Node;
  sourceDoc: RichTextDocument;
  syncPlugin: Plugin;
};

type EditorBaseProps = SharedEditorProps & {
  bindContent: (schema: Schema) => Promise<ContentBinding>;
  diffWith?: RichTextDocument;
};

// The editing layer: everything that turns a rendered document into an editable one.
// Read-only views skip this layer and use ProseMirrorEditor directly.
export const EditorBase = ({
  bindContent,
  diffWith,
  isToolbarOpen = false,
  pickAsset,
  resolveAssetSrc,
}: EditorBaseProps) => {
  const { view, parseMarkdown, convertFromProseMirror, proseMirrorDiff } =
    useContext(ProseMirrorContext);
  const [leafBlockType, setLeafBlockType] = useState<LeafBlockType | null>(
    null
  );
  const [containerBlockType, setContainerBlockType] =
    useState<ContainerBlockType | null>(null);
  const [strongSelected, setStrongSelected] = useState<boolean>(false);
  const [codeSelected, setCodeSelected] = useState<boolean>(false);
  const [emSelected, setEmSelected] = useState<boolean>(false);
  const [selectionIsLink, setSelectionIsLink] = useState<boolean>(false);
  const [horizontalRuleEnabled, setHorizontalRuleEnabled] =
    useState<boolean>(false);
  const [imageEnabled, setImageEnabled] = useState<boolean>(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState<boolean>(false);
  const [linkDialogInitialAttrs, setLinkDialogInitialAttrs] =
    useState<LinkAttrs>({ title: '', href: '' });
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState<boolean>(false);
  // Using state instead of useRef to trigger a popover re-render when the link ref changes
  const [selectedLinkData, setSelectedLinkData] = useState<{
    ref: Element;
    linkAttrs: LinkAttrs;
  } | null>(null);

  const onSelectionChange: (
    schema: Schema
  ) => (selection: Selection, view: EditorView) => void =
    (schema) => (selection, view) => {
      const hideLinkPopover = () => {
        setSelectedLinkData(null);
        setIsLinkPopoverOpen(false);
      };

      if (isMarkActive(schema.marks.link)(view.state)) {
        const link = findLinkAtSelection({ view, selection });
        if (link) {
          setSelectedLinkData({ ref: link.element, linkAttrs: link.linkAttrs });
          setIsLinkPopoverOpen(true);
        } else {
          hideLinkPopover();
        }
      } else {
        hideLinkPopover();
      }
    };

  const buildPlugins = ({
    schema,
    syncPlugin,
    diffPlugin,
  }: {
    schema: Schema;
    syncPlugin: Plugin;
    diffPlugin: Plugin | null;
  }) => [
    assetsPlugin(resolveAssetSrc),
    buildInputRules(schema),
    placeholderPlugin('Start writing...'),
    ...markdownMarkPlugins(schema),
    pasteMarkdownPlugin(parseMarkdown(schema)),
    // Must come before `notesPlugin`, which installs a `handleKeyDown`
    // for Backspace/Delete that falls back to PM's default chain.
    keymap({
      Backspace: deleteFigureBeforeCursor,
      Delete: deleteFigureAfterCursor,
      Enter: chainCommands(
        moveToParagraphAfterSelectedFigure,
        splitListItem(schema.nodes.list_item)
      ),
      'Mod-b': toggleStrong(schema),
      'Mod-i': toggleEm(schema),
      'Mod-z': undo,
      'Mod-y': redo,
      'Shift-Mod-z': redo,
      'Mod-[': liftListItem(schema.nodes.list_item),
      'Mod-]': sinkListItem(schema.nodes.list_item),
      'Mod-Alt-f': insertNote,
      // Disable tab keystrokes in the editor to prevent tabbing
      // to the next focusable element
      Tab: () => true,
    }),
    notesPlugin(),
    codeBlockHighlightPlugin,
    history(),
    keymap(baseKeymap),
    searchPlugin(),
    linkSelectionPlugin,
    selectionChangePlugin(onSelectionChange(schema)),
    ensureTrailingParagraphPlugin(schema),
    moveCursorToNextBlockOnInsertionPlugin(schema),
    ensureTrailingSpaceAfterAtomPlugin(),
    removeEmptyFiguresPlugin(schema),
    syncPlugin,
    ...(diffPlugin ? [diffPlugin] : []),
  ];

  useKeyBindings({
    [keyBindings.ctrlShiftL.keyBinding]: () => {
      handleLinkToggle();
    },
  });

  const buildDiffPlugin = async ({
    currentDoc,
    diffWith,
  }: {
    currentDoc: RichTextDocument;
    diffWith: RichTextDocument;
  }) => {
    const contentBefore = getDocumentRichTextContent(diffWith);
    const contentAfter = getDocumentRichTextContent(currentDoc);

    const { decorations } = await proseMirrorDiff({
      representation: currentDoc.representation,
      proseMirrorSchema: schema,
      docBefore: contentBefore,
      docAfter: contentAfter,
      transformImageSrc: resolveAssetSrc,
    });

    return diffPlugin({
      decorations,
      proseMirrorDiff,
      convertFromProseMirror,
      transformImageSrc: resolveAssetSrc,
      diffWith,
    });
  };

  const createSeed = useCallback(
    async (schema: Schema): Promise<EditorSeed> => {
      const { pmDoc, sourceDoc, syncPlugin } = await bindContent(schema);

      // Apply the trailing-paragraph invariant (a place to put the cursor
      // after a figure) up-front: the plugin only fires after the first
      // transaction.
      const doc = ensureTrailingParagraphInDoc(pmDoc, schema);

      const diffPlugin = diffWith
        ? await buildDiffPlugin({ currentDoc: sourceDoc, diffWith })
        : null;

      return { doc, plugins: buildPlugins({ schema, syncPlugin, diffPlugin }) };
    },
    // diffWith is deliberately not a dependency: changes to it are handled
    // by rebuildPlugins (an in-place plugin swap that keeps the user's
    // edited doc) — a new seed would rebuild the doc from the source and
    // discard unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bindContent]
  );

  const seed = useEditorSeed(createSeed);

  const rebuildPlugins = useCallback(
    async ({
      schema,
      currentDoc: currentPmDoc,
    }: {
      schema: Schema;
      currentDoc: Node;
    }): Promise<Plugin[]> => {
      const { syncPlugin } = await bindContent(schema);

      if (!diffWith) {
        return buildPlugins({ schema, syncPlugin, diffPlugin: null });
      }

      const currentDocContent = await convertFromProseMirror({
        pmDoc: currentPmDoc,
        to: diffWith.representation,
      });

      const currentDoc: RichTextDocument = {
        representation: diffWith.representation,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        content: currentDocContent,
      };

      const diffPlugin = await buildDiffPlugin({ currentDoc, diffWith });

      return buildPlugins({ schema, syncPlugin, diffPlugin });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bindContent, diffWith]
  );

  const handleTransaction = useCallback(
    ({ state, tx }: { state: EditorState; tx: Transaction }) => {
      setLeafBlockType(getCurrentLeafBlockType(state));
      setContainerBlockType(getCurrentContainerBlockType(state));
      setHorizontalRuleEnabled(canInsertHorizontalRule(state));
      setImageEnabled(canInsertFigure(state));

      if (tx.selectionSet || transactionUpdatesMarks(tx)) {
        setStrongSelected(isMarkActive(schema.marks.strong)(state));
        setEmSelected(isMarkActive(schema.marks.em)(state));
        setSelectionIsLink(isMarkActive(schema.marks.link)(state));
        setCodeSelected(isMarkActive(schema.marks.code)(state));
      }
    },
    []
  );

  const handleViewReady = useCallback(
    ({ view: editorView, state }: { view: EditorView; state: EditorState }) => {
      editorView.focus();
      setLeafBlockType(getCurrentLeafBlockType(state));
      setContainerBlockType(getCurrentContainerBlockType(state));
      setHorizontalRuleEnabled(canInsertHorizontalRule(state));
      setImageEnabled(canInsertFigure(state));
    },
    []
  );

  const handleBlockSelect = (type: BlockType) => {
    if (view) {
      const { $from } = view.state.selection;

      switch (type) {
        case blockTypes.HEADING_1:
        case blockTypes.HEADING_2:
        case blockTypes.HEADING_3:
        case blockTypes.HEADING_4:
        case blockTypes.HEADING_5:
        case blockTypes.HEADING_6: {
          const level = getHeadingLevel(type);

          if (
            $from.node().type.name === 'heading' &&
            $from.node().attrs.level === level
          ) {
            setProsemirrorBlockType(view.state.schema.nodes.paragraph)(
              view.state,
              view.dispatch,
              view
            );
          } else {
            setProsemirrorBlockType(view.state.schema.nodes.heading, {
              level,
            })(view.state, view.dispatch, view);
          }
          break;
        }
        case blockTypes.CODE_BLOCK:
          setProsemirrorBlockType(view.state.schema.nodes.code_block)(
            view.state,
            view.dispatch,
            view
          );
          break;
        case blockTypes.BLOCKQUOTE:
          wrapIn(view.state.schema.nodes.blockquote)(
            view.state,
            view.dispatch,
            view
          );
          break;
        case blockTypes.BULLET_LIST:
          wrapInList(view.state.schema.nodes.bullet_list)(
            view.state,
            view.dispatch,
            view
          );
          break;
        case blockTypes.ORDERED_LIST:
          wrapInList(view.state.schema.nodes.ordered_list)(
            view.state,
            view.dispatch,
            view
          );
          break;
        case blockTypes.PARAGRAPH:
        default:
          setProsemirrorBlockType(view.state.schema.nodes.paragraph)(
            view.state,
            view.dispatch,
            view
          );
          break;
      }
    }
  };
  const handleStrongToggle = () => {
    if (view && schema) {
      toggleStrong(schema)(view.state, view.dispatch);
      view.focus();
    }
  };

  const handleEmToggle = () => {
    if (view && schema) {
      toggleEm(schema)(view.state, view.dispatch);
      view.focus();
    }
  };

  const handleLinkToggle = () => {
    if (view && schema) {
      if (!isMarkActive(schema.marks.link)(view.state)) {
        const selectedText = getSelectedText(view.state);
        setLinkDialogInitialAttrs({ title: selectedText ?? '', href: '' });
        setIsLinkDialogOpen(true);
      } else {
        handleEditLink();
      }

      view.focus();
    }
  };

  const handleCodeToggle = () => {
    if (view && schema) {
      toggleCode(schema)(view.state, view.dispatch);
      view.focus();
    }
  };

  const handleSaveLink = (attrs: LinkAttrs) => {
    if (view && schema) {
      if (!isMarkActive(schema.marks.link)(view.state)) {
        addLink(schema)(attrs)(view.state, view.dispatch);
      } else {
        updateLink(schema)(attrs)(view.state, view.dispatch);
      }
      view.focus();
    }

    setIsLinkDialogOpen(false);
  };

  const handleEditLink = () => {
    if (selectedLinkData) {
      setLinkDialogInitialAttrs(selectedLinkData.linkAttrs);
      setIsLinkPopoverOpen(false);
      setIsLinkDialogOpen(true);
    }
  };

  const handleRemoveLink = () => {
    if (view && schema) {
      removeLink(schema)(view.state, view.dispatch);
      view.focus();
    }

    setIsLinkPopoverOpen(false);
    setIsLinkDialogOpen(false);
  };

  const handleCloseLinkPopover = () => {
    setIsLinkPopoverOpen(false);
    view?.focus();
  };

  const handleNoteClick = () => {
    if (view && schema) {
      insertNote(view.state, view.dispatch);
      view.focus();
    }
  };

  const handleHorizontalRuleClick = () => {
    if (view && schema) {
      insertHorizontalRule(view.state, view.dispatch);
      view.focus();
    }
  };

  const handleImageClick = async () => {
    if (!view) return;
    try {
      await pickAndInsertFigure(pickAsset)(view);
      view.focus();
    } catch (err) {
      console.error(err);
    }
  };

  if (!seed) {
    return <LongTextSkeleton />;
  }

  return (
    <>
      <div
        className="flex flex-auto p-4 outline-none"
        onClick={() => view?.focus()}
      >
        <ProseMirrorEditor
          seed={seed}
          rebuildPlugins={rebuildPlugins}
          onTransaction={handleTransaction}
          onViewReady={handleViewReady}
        />
      </div>

      <FindBar />

      {leafBlockType && (
        <div
          className={clsx(
            'absolute self-center drop-shadow transition-bottom',
            isToolbarOpen ? 'bottom-4' : '-bottom-12'
          )}
        >
          <EditorToolbar
            leafBlockType={leafBlockType}
            containerBlockType={containerBlockType}
            onBlockSelect={handleBlockSelect}
            strongSelected={strongSelected}
            emSelected={emSelected}
            selectionIsLink={selectionIsLink}
            codeSelected={codeSelected}
            onStrongToggle={handleStrongToggle}
            onEmToggle={handleEmToggle}
            onLinkToggle={handleLinkToggle}
            onCodeToggle={handleCodeToggle}
            onNoteClick={handleNoteClick}
            onHorizontalRuleClick={handleHorizontalRuleClick}
            horizontalRuleEnabled={horizontalRuleEnabled}
            onImageClick={handleImageClick}
            imageEnabled={imageEnabled}
          />
        </div>
      )}
      <LinkDialog
        initialLinkAttrs={linkDialogInitialAttrs}
        isOpen={isLinkDialogOpen}
        onCancel={() => setIsLinkDialogOpen(false)}
        onSave={handleSaveLink}
      />
      <LinkPopover
        linkData={selectedLinkData}
        isOpen={isLinkPopoverOpen}
        onEditLink={handleEditLink}
        onRemoveLink={handleRemoveLink}
        onClose={handleCloseLinkPopover}
      />
    </>
  );
};
