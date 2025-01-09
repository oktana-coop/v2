import { init } from '@automerge/prosemirror';
import { clsx } from 'clsx';
import {
  baseKeymap,
  setBlockType as setProsemirrorBlockType,
} from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { Schema } from 'prosemirror-model';
import { EditorState, Selection, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { ElectronContext } from '../../../../modules/electron';
import {
  getHeadingLevel,
  getLinkAttrsFromDomElement,
  LinkAttrs,
  prosemirror,
} from '../../../../modules/rich-text';
import {
  BlockElementType,
  blockElementTypes,
} from '../../../../modules/rich-text/constants/blocks';
import type {
  DocHandle,
  RichTextDocument,
} from '../../../../modules/version-control';
import { EditorToolbar } from './editor-toolbar';
import { LinkDialog } from './LinkDialog';
import { LinkPopover } from './LinkPopover';

const {
  automergeSchemaAdapter,
  buildInputRules,
  getCurrentBlockType,
  isMarkActive,
  toggleEm,
  toggleStrong,
  transactionUpdatesMarks,
  addLink,
  removeLink,
  updateLink,
  linkSelectionPlugin,
  selectionChangePlugin,
  getSelectedText,
  findLinkAtSelection,
} = prosemirror;

type RichTextEditorProps = {
  docHandle: DocHandle<RichTextDocument>;
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
  const [view, setView] = useState<EditorView | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [blockType, setBlockType] = useState<BlockElementType | null>(null);
  const [strongSelected, setStrongSelected] = useState<boolean>(false);
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
  const { openExternalLink } = useContext(ElectronContext);

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

  const handleViewClick = useCallback(
    (_: EditorView, ev: MouseEvent): boolean | undefined => {
      if (ev.target instanceof HTMLElement && ev.target.tagName === 'A') {
        const linkAttrs = getLinkAttrsFromDomElement(ev.target);

        if (linkAttrs.href) {
          ev.preventDefault();
          openExternalLink(linkAttrs.href);
          return true;
        }
      }

      // Allow other handlers to process the event
      return false;
    },
    [openExternalLink]
  );

  useEffect(() => {
    if (docHandle) {
      const {
        schema,
        pmDoc,
        plugin: automergePlugin,
      } = init(docHandle, ['content'], {
        schemaAdapter: automergeSchemaAdapter,
      });

      const editorConfig = {
        schema,
        plugins: [
          buildInputRules(schema),
          keymap({
            ...baseKeymap,
            'Mod-b': toggleStrong(schema),
            'Mod-i': toggleEm(schema),
            'Mod-s': () => {
              onSave();
              return true;
            },
          }),
          linkSelectionPlugin,
          selectionChangePlugin(onSelectionChange(schema)),
          automergePlugin,
        ],
        doc: pmDoc,
      };

      const state = EditorState.create(editorConfig);
      const view = new EditorView(editorRoot.current, {
        state,
        dispatchTransaction: (tx: Transaction) => {
          const newState = view.state.apply(tx);
          view.updateState(newState);

          // React state updates
          setBlockType(getCurrentBlockType(newState));

          if (tx.selectionSet || transactionUpdatesMarks(tx)) {
            setStrongSelected(isMarkActive(schema.marks.strong)(newState));
            setEmSelected(isMarkActive(schema.marks.em)(newState));
            setSelectionIsLink(isMarkActive(schema.marks.link)(newState));
          }
        },
        editable: () => isEditable,
        handleDOMEvents: {
          click: handleViewClick,
        },
      });

      setView(view);
      setSchema(schema);

      return () => {
        view.destroy();
      };
    }
  }, [docHandle, onSave, isEditable, handleViewClick]);

  const handleBlockSelect = (type: BlockElementType) => {
    if (view) {
      const { $from } = view.state.selection;

      switch (type) {
        case blockElementTypes.HEADING_1:
        case blockElementTypes.HEADING_2:
        case blockElementTypes.HEADING_3:
        case blockElementTypes.HEADING_4: {
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
        case blockElementTypes.PARAGRAPH:
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

  return (
    <>
      <div className="flex flex-auto overflow-auto outline-none">
        <div className="p-4" id="editor" ref={editorRoot} />
      </div>

      {isEditable && blockType && (
        <div
          className={clsx(
            'absolute self-center drop-shadow transition-bottom',
            isToolbarOpen ? 'bottom-4' : '-bottom-12'
          )}
        >
          <EditorToolbar
            blockType={blockType}
            onBlockSelect={handleBlockSelect}
            strongSelected={strongSelected}
            emSelected={emSelected}
            selectionIsLink={selectionIsLink}
            onStrongToggle={handleStrongToggle}
            onEmToggle={handleEmToggle}
            onLinkToggle={handleLinkToggle}
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
          />
        </>
      )}
    </>
  );
};
