import {
  AutomergeUrl,
  DocHandleChangePayload,
} from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { AutoMirror } from '@automerge/prosemirror';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { MarkType, Schema } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { Command, EditorState, Transaction } from 'prosemirror-state';
import React, { useEffect, useRef } from 'react';
import { CommitDialog } from './CommitDialog';
import { VersionedDocument } from '../automerge';
import { writeFile } from '../utils/filesystem';
import { useHandle } from '../automerge/repo';

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
  fileHandle,
}: {
  docUrl: AutomergeUrl;
  fileHandle: FileSystemFileHandle;
}) => {
  const editorRoot = useRef<HTMLDivElement>(null);
  const [value, changeValue] = React.useState<string>('');
  const [isCommitting, openCommitDialog] = React.useState<boolean>(false);
  const [versionedDocument, changeDocument] =
    useDocument<VersionedDocument>(docUrl);
  const { handle, isReady: isHandleReady } = useHandle(docUrl);

  useEffect(() => {
    if (isHandleReady && handle && versionedDocument) {
      changeValue(versionedDocument.content || '');
      document.title = `v2 | editing "${versionedDocument.title}"`;

      const autoMirror = new AutoMirror(['text']);

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
        doc: autoMirror.initialize(handle),
      };

      const state = EditorState.create(editorConfig);
      const view = new EditorView(editorRoot.current, {
        state,
        dispatchTransaction: (tx: Transaction) => {
          const newState = autoMirror.intercept(handle, tx, view.state);
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

      handle.on('change', onPatch);
    }
  }, [isHandleReady]);

  const commitChanges = (message: string) => {
    changeDocument(
      (doc) => {
        doc.content = value;
      },
      {
        message,
        time: new Date().getTime(),
      }
    );

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
