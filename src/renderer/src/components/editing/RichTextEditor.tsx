import { init } from '@automerge/prosemirror';
import { clsx } from 'clsx';
import {
  baseKeymap,
  setBlockType as setProsemirrorBlockType,
} from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { Schema } from 'prosemirror-model';
import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useEffect, useRef, useState } from 'react';

import { getHeadingLevel, prosemirror } from '../../../../modules/rich-text';
import {
  BlockElementType,
  blockElementTypes,
} from '../../../../modules/rich-text/constants/blocks';
import type {
  DocHandle,
  VersionedDocument,
} from '../../../../modules/version-control';
import { EditorToolbar } from './editor-toolbar';

const {
  automergeSchemaAdapter,
  buildInputRules,
  getCurrentBlockType,
  isMarkActive,
  toggleEm,
  toggleStrong,
  transactionUpdatesMarks,
} = prosemirror;

type RichTextEditorProps = {
  docHandle: DocHandle<VersionedDocument>;
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
  const [strongSelected, setStrongSelected] = useState<boolean>(false);
  const [emSelected, setEmSelected] = useState<boolean>(false);
  const [blockType, setBlockType] = useState<BlockElementType | null>(null);

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
          }
        },
        editable: () => isEditable,
      });

      setView(view);
      setSchema(schema);

      return () => {
        view.destroy();
      };
    }
  }, [docHandle, onSave, isEditable]);

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

  return (
    <>
      <div
        className="flex flex-auto p-4 outline-none"
        id="editor"
        ref={editorRoot}
      />
      {blockType && (
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
            onStrongToggle={handleStrongToggle}
            onEmToggle={handleEmToggle}
          />
        </div>
      )}
    </>
  );
};
