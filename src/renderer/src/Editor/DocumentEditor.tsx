import {
  AutomergeUrl,
  DocHandleChangePayload,
  DocHandle,
} from '@automerge/automerge-repo';
import { AutoMirror } from '@automerge/prosemirror';
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { MarkType, Schema } from 'prosemirror-model';
import { Command, EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useEffect, useRef } from 'react';
import { writeFile } from '../filesystem';
import { CommitDialog } from './CommitDialog';
import { VersionedDocument } from '../automerge';

const toggleMarkCommand = (mark: MarkType): Command => {
  return (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined
  ) => {
    return toggleMark(mark)(state, dispatch);
  };
};

export const DocumentEditor = ({
  docUrl,
  automergeHandle,
  fileHandle,
}: {
  docUrl: AutomergeUrl;
  automergeHandle: DocHandle<VersionedDocument>;
  fileHandle: FileSystemFileHandle;
}) => {
  const editorRoot = useRef<HTMLDivElement>(null);
  const [isCommitting, openCommitDialog] = React.useState<boolean>(false);

  useEffect(() => {
    if (automergeHandle) {
      document.title = `v2 | editing "${automergeHandle.docSync()?.title}"`;
      const autoMirror = new AutoMirror(['content']);
      const toggleBold = (schema: Schema) =>
        toggleMarkCommand(schema.marks.strong);
      const toggleItalic = (schema: Schema) =>
        toggleMarkCommand(schema.marks.em);

      const editorConfig = {
        schema: autoMirror.schema, // This _must_ be the schema from the AutoMirror
        plugins: [
          keymap({
            ...baseKeymap,
            'Mod-b': toggleBold(autoMirror.schema),
            'Mod-i': toggleItalic(autoMirror.schema),
            'Mod-s': () => {
              openCommitDialog(true);
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
  }, [automergeHandle]);

  const commitChanges = (message: string) => {
    if (!automergeHandle) return;
    automergeHandle.change(
      (doc) => {
        // this is effectively a no-op, but it triggers a change event
        // (not) changing the title of the document, as interfering with the
        // content outside the Prosemirror API will cause loss of formatting
        // eslint-disable-next-line no-self-assign
        doc.title = doc.title;
      },
      {
        message,
        time: new Date().getTime(),
      }
    );

    const value = automergeHandle.docSync()?.content || '';
    const fileContent = {
      docUrl,
      value,
    };
    writeFile(fileHandle, fileContent);

    openCommitDialog(false);
  };

  return (
    <>
      <CommitDialog
        isOpen={isCommitting}
        onCancel={() => openCommitDialog(false)}
        onCommit={(message: string) => commitChanges(message)}
      />
      <div
        className="w-4/5 flex-auto p-5 flex outline-none"
        id="editor"
        ref={editorRoot}
      />
    </>
  );
};
