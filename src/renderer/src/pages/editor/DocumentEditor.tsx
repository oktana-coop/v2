import { useCallback, useEffect, useState } from 'react';

import { type VersionedDocumentHandle } from '../../../../modules/version-control';
import { RichTextEditor } from '../../components/editing/RichTextEditor';
import { ActionsBar } from './ActionsBar';
import { CommitDialog } from './CommitDialog';

export const DocumentEditor = ({
  versionedDocumentHandle,
}: {
  versionedDocumentHandle: VersionedDocumentHandle;
}) => {
  const [isCommitting, openCommitDialog] = useState<boolean>(false);
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);

  useEffect(() => {
    if (versionedDocumentHandle) {
      document.title = `v2 | editing "${versionedDocumentHandle.docSync()?.title}"`;
    }
  }, [versionedDocumentHandle]);

  const commitChanges = (message: string) => {
    if (!versionedDocumentHandle) return;

    versionedDocumentHandle.change(
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
  };

  const handleEditorToolbarToggle = useCallback(() => {
    toggleEditorToolbar(!isEditorToolbarOpen);
  }, [isEditorToolbarOpen]);

  const handleSave = useCallback(() => {
    openCommitDialog(true);
  }, []);

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
          docHandle={versionedDocumentHandle}
          onSave={handleSave}
          isToolbarOpen={isEditorToolbarOpen}
        />
      </div>
    </>
  );
};
