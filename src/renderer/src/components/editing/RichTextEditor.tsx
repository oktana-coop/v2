import { clsx } from 'clsx';
import {
  baseKeymap,
  setBlockType as setProsemirrorBlockType,
} from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { type Node, type Schema } from 'prosemirror-model';
import { EditorState, Selection, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useContext, useEffect, useRef, useState } from 'react';

import {
  type BlockType,
  blockTypes,
  type ContainerBlockType,
  getHeadingLevel,
  type LeafBlockType,
  LinkAttrs,
  prosemirror,
  type RichTextDocument,
  richTextRepresentations,
  type VersionedDocumentHandle,
} from '../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../modules/domain/rich-text/react/prosemirror-context';
import { versionedArtifactTypes } from '../../../../modules/infrastructure/version-control';
import { EditorToolbar } from './editor-toolbar';
import { LinkDialog } from './LinkDialog';
import { LinkPopover } from './LinkPopover';

const {
  buildInputRules,
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
  wrapInList,
  wrapIn,
  splitListItem,
  liftListItem,
  sinkListItem,
  pasteMarkdownPlugin,
  markdownMarkPlugins,
  insertNote,
  notesPlugin,
  numberNotes,
  placeholderPlugin,
  syncPlugin,
  pmDocFromJSONString,
  pmDocToJSONString,
} = prosemirror;

type RichTextEditorProps = {
  doc: RichTextDocument;
  docHandle: VersionedDocumentHandle | null;
  onSave: () => void;
  onDocChange?: (doc: RichTextDocument) => Promise<void>;
  isEditable?: boolean;
  isToolbarOpen?: boolean;
};

export const RichTextEditor = ({
  docHandle,
  doc,
  onSave,
  onDocChange,
  isEditable = true,
  isToolbarOpen = false,
}: RichTextEditorProps) => {
  const editorRoot = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const { schema, view, setView, parseMarkdown, convertToProseMirror } =
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

  useEffect(() => {
    const setupEditorAndView = async (schema: Schema) => {
      const plugins = [
        buildInputRules(schema),
        placeholderPlugin('Start writing...'),
        ...markdownMarkPlugins(schema),
        pasteMarkdownPlugin(parseMarkdown(schema)),
        notesPlugin(),
        history(),
        keymap({
          'Mod-b': toggleStrong(schema),
          'Mod-i': toggleEm(schema),
          'Mod-z': undo,
          'Mod-y': redo,
          'Shift-Mod-z': redo,
          Enter: splitListItem(schema.nodes.list_item),
          'Mod-[': liftListItem(schema.nodes.list_item),
          'Mod-]': sinkListItem(schema.nodes.list_item),
          // Disable tab keystrokes in the editor to prevent tabbing
          // to the next focusable element
          Tab: () => true,
        }),
        keymap(baseKeymap),
        linkSelectionPlugin,
        selectionChangePlugin(onSelectionChange(schema)),
        ensureTrailingParagraphPlugin(schema),
        ensureTrailingSpaceAfterAtomPlugin(),
      ];

      if (isEditable && onDocChange) {
        const handlePMDocChange = (pmDoc: Node) => {
          const pmJSONStr = pmDocToJSONString(pmDoc);

          onDocChange({
            type: versionedArtifactTypes.RICH_TEXT_DOCUMENT,
            representation: richTextRepresentations.PROSEMIRROR,
            content: pmJSONStr,
          });
        };

        plugins.push(
          syncPlugin({
            onPMDocChange: handlePMDocChange,
            docHandle,
          })
        );
      }

      const pmDoc =
        doc.representation !== richTextRepresentations.PROSEMIRROR
          ? await convertToProseMirror({
              schema: schema,
              document: doc,
            })
          : pmDocFromJSONString(doc.content, schema);

      const editorConfig = {
        schema,
        plugins,
        doc: pmDoc,
      };

      const state = EditorState.create(editorConfig);
      const view = new EditorView(editorRoot.current, {
        state,
        dispatchTransaction: (tx: Transaction) => {
          const newState = view.state.apply(tx);
          view.updateState(newState);

          // React state updates
          setLeafBlockType(getCurrentLeafBlockType(newState));
          setContainerBlockType(getCurrentContainerBlockType(newState));

          if (tx.selectionSet || transactionUpdatesMarks(tx)) {
            setStrongSelected(isMarkActive(schema.marks.strong)(newState));
            setEmSelected(isMarkActive(schema.marks.em)(newState));
            setSelectionIsLink(isMarkActive(schema.marks.link)(newState));
            setCodeSelected(isMarkActive(schema.marks.code)(newState));
          }
        },
        editable: () => isEditable,
      });

      editorViewRef.current = view;

      numberNotes(state, view.dispatch, view);

      setView(view);

      if (isEditable) {
        view.focus();
        setLeafBlockType(getCurrentLeafBlockType(state));
        setContainerBlockType(getCurrentContainerBlockType(state));
      }
    };

    if (schema) {
      setupEditorAndView(schema);
    }

    return () => {
      view?.destroy();
    };
  }, [doc, docHandle, onSave, isEditable, schema, setView]);

  const handleBlockSelect = (type: BlockType) => {
    if (view) {
      const { $from } = view.state.selection;

      switch (type) {
        case blockTypes.HEADING_1:
        case blockTypes.HEADING_2:
        case blockTypes.HEADING_3:
        case blockTypes.HEADING_4: {
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

  return (
    <>
      <div
        className="flex flex-auto p-4 outline-none"
        onClick={() => editorViewRef.current?.focus()}
      >
        <div className="editor flex-auto" id="editor" ref={editorRoot} />
      </div>

      {isEditable && leafBlockType && (
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
          />
        </div>
      )}
      {isEditable && (
        <>
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
      )}
    </>
  );
};
