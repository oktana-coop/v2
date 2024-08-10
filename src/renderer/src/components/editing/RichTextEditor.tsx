import { DocHandle, DocHandleChangePayload } from '@automerge/automerge-repo';
import { AutoMirror } from '@automerge/prosemirror';
import { clsx } from 'clsx';
import {
  baseKeymap,
  setBlockType as setProsemirrorBlockType,
  toggleMark,
} from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { MarkType, Schema } from 'prosemirror-model';
import { Command, EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useEffect, useRef, useState } from 'react';

import { VersionedDocument } from '../../automerge';
import { getHeadingLevel, prosemirror } from '../../richText/';
import {
  BlockElementType,
  blockElementTypes,
} from '../../richText/constants/blocks';
import { EditorToolbar } from './EditorToolbar';

const { automergeSchemaAdapter, buildInputRules, getCurrentBlockType } =
  prosemirror;

const toggleStrong = (schema: Schema) => toggleMarkCommand(schema.marks.strong);

const toggleEm = (schema: Schema) => toggleMarkCommand(schema.marks.em);

const toggleMarkCommand = (mark: MarkType): Command => {
  return (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined
  ) => {
    return toggleMark(mark)(state, dispatch);
  };
};

type RichTextEditorProps = {
  docHandle: DocHandle<VersionedDocument>;
  onSave?: () => void;
  isEditable?: boolean;
  isToolbarOpen?: boolean;
};

export const RichTextEditor = ({
  docHandle,
  onSave = () => {},
  isEditable = true,
  isToolbarOpen = false,
}: RichTextEditorProps) => {
  const editorRoot = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [blockType, setBlockType] = useState<BlockElementType | null>(null);

  useEffect(() => {
    if (docHandle) {
      document.title = `v2 | editing "${docHandle.docSync()?.title}"`;
      const autoMirror = new AutoMirror(['content'], automergeSchemaAdapter);

      const editorConfig = {
        schema: autoMirror.schema, // This _must_ be the schema from the AutoMirror
        plugins: [
          buildInputRules(autoMirror.schema),
          keymap({
            ...baseKeymap,
            'Mod-b': toggleStrong(autoMirror.schema),
            'Mod-i': toggleEm(autoMirror.schema),
            'Mod-s': () => {
              onSave();
              return true;
            },
          }),
        ],
        doc: autoMirror.initialize(docHandle),
      };

      const state = EditorState.create(editorConfig);
      const view = new EditorView(editorRoot.current, {
        state,
        dispatchTransaction: (tx: Transaction) => {
          const newState = autoMirror.intercept(docHandle, tx, view.state);
          view.updateState(newState);

          // React state updates
          setBlockType(getCurrentBlockType(newState));
        },
        editable: () => isEditable,
      });

      setView(view);
      setSchema(autoMirror.schema);

      const onPatch: (args: DocHandleChangePayload<unknown>) => void = ({
        doc,
        patches,
        patchInfo,
      }) => {
        const newState = autoMirror.reconcilePatch(
          patchInfo.before,
          doc,
          patches,
          view.state
        );
        view.updateState(newState);
      };

      docHandle.on('change', onPatch);

      return () => {
        docHandle.off('change', onPatch);
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
            onBlockSelect={handleBlockSelect}
            onStrongToggle={handleStrongToggle}
            onEmToggle={handleEmToggle}
            blockType={blockType}
          />
        </div>
      )}
    </>
  );
};
