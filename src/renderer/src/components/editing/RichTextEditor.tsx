import { init } from '@oktana-coop/automerge-prosemirror';
import { clsx } from 'clsx';
import {
  baseKeymap,
  setBlockType as setProsemirrorBlockType,
} from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { Schema } from 'prosemirror-model';
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
  type VersionedDocumentHandle,
} from '../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../modules/domain/rich-text/react/prosemirror-context';
import { EditorToolbar } from './editor-toolbar';
import { LinkDialog } from './LinkDialog';
import { LinkPopover } from './LinkPopover';

const {
  automergeSchemaAdapter,
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
} = prosemirror;

type RichTextEditorProps = {
  docHandle: VersionedDocumentHandle;
  onSave: () => void;
  isEditable?: boolean;
  isToolbarOpen?: boolean;
};

export const RichTextEditor = ({
  docHandle,
  onSave,
  isEditable = true,
  isToolbarOpen = false,
}: RichTextEditorProps) => {
  const editorRoot = useRef<HTMLDivElement>(null);
  const { schema, view, setView, setSchema, parseMarkdown } =
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
    if (docHandle) {
      const {
        schema,
        pmDoc,
        plugin: automergeSyncPlugin,
      } = init(docHandle, ['content'], {
        schemaAdapter: automergeSchemaAdapter,
      });

      const plugins = [
        buildInputRules(schema),
        ...markdownMarkPlugins(schema),
        pasteMarkdownPlugin(parseMarkdown(schema)),
        notesPlugin(),
        history(),
        keymap({
          'Mod-b': toggleStrong(schema),
          'Mod-i': toggleEm(schema),
          'Mod-s': () => {
            onSave();
            return true;
          },
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
        automergeSyncPlugin,
      ];

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
      numberNotes(state, view.dispatch, view);

      setView(view);
      setSchema(schema);

      if (isEditable) {
        view.focus();
        setLeafBlockType(getCurrentLeafBlockType(state));
        setContainerBlockType(getCurrentContainerBlockType(state));
      }

      return () => {
        view.destroy();
      };
    }
  }, [docHandle, onSave, isEditable, setSchema, setView]);

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
      <div className="flex flex-auto p-4 outline-none">
        <div className="flex-auto" id="editor" ref={editorRoot} />
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
