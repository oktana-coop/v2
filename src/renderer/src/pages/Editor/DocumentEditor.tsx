import { AutomergeUrl, DocHandle } from '@automerge/automerge-repo';
import { clsx } from 'clsx';
import React, { useEffect } from 'react';
import { VersionedDocument } from '../../automerge';
import { ActionsBar } from './ActionsBar';
import { CommitDialog } from './CommitDialog';
import { EditorToolbar } from './EditorToolbar';
import { RichTextEditor } from './RichTextEditor';

export const DocumentEditor = ({
  automergeHandle,
  onDocumentChange,
}: {
  automergeHandle: DocHandle<VersionedDocument>;
  onDocumentChange: (docUrl: AutomergeUrl, value: string) => void;
}) => {
  const [isCommitting, openCommitDialog] = React.useState<boolean>(false);
  const [isEditorToolbarOpen, toggleEditorToolbar] =
    React.useState<boolean>(false);

  useEffect(() => {
    if (automergeHandle) {
      document.title = `v2 | editing "${automergeHandle.docSync()?.title}"`;
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

    openCommitDialog(false);

    const content = automergeHandle.docSync()?.content || '';
    const docUrl = automergeHandle.url;
    return onDocumentChange(docUrl, content);
  };

  const handleEditorToolbarToggle = () => {
    toggleEditorToolbar(!isEditorToolbarOpen);
  };

  return (
    <>
      <CommitDialog
        isOpen={isCommitting}
        onCancel={() => openCommitDialog(false)}
        onCommit={(message: string) => commitChanges(message)}
      />
      <div className="relative flex w-4/5 flex-auto flex-col items-stretch overflow-hidden">
        <ActionsBar onEditorToolbarToggle={handleEditorToolbarToggle} />
        <RichTextEditor
          automergeHandle={automergeHandle}
          onSave={() => {
            openCommitDialog(true);
          }}
        />
        <div
          className={clsx(
            'absolute self-center drop-shadow transition-bottom',
            isEditorToolbarOpen ? 'bottom-4' : '-bottom-10'
          )}
        >
          <EditorToolbar />
        </div>
      </div>
    </>
  );
};
