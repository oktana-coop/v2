import { DocHandle, DocHandleChangePayload } from '@automerge/automerge-repo';
import { AutoMirror } from '@automerge/prosemirror';
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { MarkType, Schema } from 'prosemirror-model';
import { Command, EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useEffect, useRef } from 'react';

import { VersionedDocument } from '../../automerge';

const toggleBold = (schema: Schema) => toggleMarkCommand(schema.marks.strong);

const toggleItalic = (schema: Schema) => toggleMarkCommand(schema.marks.em);

const toggleMarkCommand = (mark: MarkType): Command => {
  return (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined
  ) => {
    return toggleMark(mark)(state, dispatch);
  };
};

type RichTextEditorProps = {
  automergeHandle: DocHandle<VersionedDocument>;
  onSave?: () => void;
  isEditable?: boolean;
};

export const RichTextEditor = ({
  automergeHandle,
  onSave = () => {},
  isEditable = true,
}: RichTextEditorProps) => {
  const editorRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (automergeHandle) {
      const autoMirror = new AutoMirror(['content']);
      const editorConfig = {
        schema: autoMirror.schema, // This _must_ be the schema from the AutoMirror
        plugins: [
          keymap({
            ...baseKeymap,
            'Mod-b': toggleBold(autoMirror.schema),
            'Mod-i': toggleItalic(autoMirror.schema),
            'Mod-s': () => {
              onSave();
              return true;
            },
          }),
        ],
        doc: autoMirror.initialize(automergeHandle),
      };

      const state = EditorState.create(editorConfig);
      const view = new EditorView(editorRoot.current, {
        state,
        dispatchTransaction: (tx: Transaction) => {
          const newState = autoMirror.intercept(
            automergeHandle,
            tx,
            view.state
          );
          view.updateState(newState);
        },
        editable: () => isEditable,
      });

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
      automergeHandle.on('change', onPatch);

      return () => {
        automergeHandle.off('change', onPatch);
        view.destroy();
      };
    }
  }, [automergeHandle, onSave, isEditable]);

  return (
    <div
      className="p-4 flex-auto flex outline-none"
      id="editor"
      ref={editorRoot}
    />
  );
};
