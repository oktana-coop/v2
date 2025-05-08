import { useCallback, useContext, useEffect, useState } from 'react';

import { ProseMirrorContext } from '../../../../modules/rich-text/react/context';
import { type VersionedDocumentHandle } from '../../../../modules/version-control';
import { RichTextEditor } from '../../components/editing/RichTextEditor';
import { ActionsBar } from './ActionsBar';
import { CommitDialog } from './CommitDialog';

export const DocumentEditor = ({
  versionedDocumentHandle,
  canCommit,
  isSidebarOpen,
  onSidebarToggle,
}: {
  versionedDocumentHandle: VersionedDocumentHandle;
  canCommit: boolean;
  isSidebarOpen: boolean;
  isCommitDialogOpen?: boolean;
  onSidebarToggle: () => void;
}) => {
  const [isCommitting, openCommitDialog] = useState<boolean>(false);
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const { view: editorView } = useContext(ProseMirrorContext);

  useEffect(() => {
    const updateDocTitle = async (docHandle: VersionedDocumentHandle) => {
      const doc = await docHandle.doc();
      document.title = `v2 | editing "${doc.title}"`;
    };

    if (versionedDocumentHandle) {
      updateDocTitle(versionedDocumentHandle);
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
    editorView?.focus();
  }, [editorView, isEditorToolbarOpen]);

  const handleSave = useCallback(() => {
    openCommitDialog(true);
  }, []);

  return (
    <>
      <CommitDialog
        isOpen={isCommitting}
        onCancel={() => openCommitDialog(false)}
        canCommit={canCommit}
        onCommit={(message: string) => commitChanges(message)}
      />
      <div className="relative flex flex-auto flex-col items-stretch overflow-hidden">
        <ActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={onSidebarToggle}
          onEditorToolbarToggle={handleEditorToolbarToggle}
          canCommit={canCommit}
          onCheckIconClick={handleSave}
        />
        <RichTextEditor
          docHandle={versionedDocumentHandle}
          onSave={handleSave}
          isToolbarOpen={isEditorToolbarOpen}
        />
      </div>
    </>
  );
};
