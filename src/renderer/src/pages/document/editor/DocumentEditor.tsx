import { useCallback, useContext, useState } from 'react';

import { SelectedFileContext } from '../../../../../modules/editor-state';
import { ProseMirrorContext } from '../../../../../modules/rich-text/react/context';
import { type VersionedDocumentHandle } from '../../../../../modules/version-control';
import { RichTextEditor } from '../../../components/editing/RichTextEditor';
import { CommitDialog } from '../commit/CommitDialog';
import { ActionsBar } from './ActionsBar';

export const DocumentEditor = ({
  versionedDocumentHandle,
  canCommit,
  isSidebarOpen,
  onSidebarToggle,
}: {
  versionedDocumentHandle: VersionedDocumentHandle;
  canCommit: boolean;
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
}) => {
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const { view: editorView } = useContext(ProseMirrorContext);
  const {
    onOpenCommitDialog,
    onCloseCommitDialog,
    isCommitDialogOpen,
    onCommit,
  } = useContext(SelectedFileContext);

  const handleEditorToolbarToggle = useCallback(() => {
    toggleEditorToolbar(!isEditorToolbarOpen);
    editorView?.focus();
  }, [editorView, isEditorToolbarOpen]);

  return (
    <>
      <CommitDialog
        isOpen={isCommitDialogOpen}
        onCancel={onCloseCommitDialog}
        canCommit={canCommit}
        onCommit={(message: string) => onCommit(message)}
      />
      <div className="relative flex flex-auto flex-col items-stretch overflow-hidden">
        <ActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={onSidebarToggle}
          onEditorToolbarToggle={handleEditorToolbarToggle}
          canCommit={canCommit}
          onCheckIconClick={onOpenCommitDialog}
        />
        <RichTextEditor
          docHandle={versionedDocumentHandle}
          onSave={onOpenCommitDialog}
          isToolbarOpen={isEditorToolbarOpen}
        />
      </div>
    </>
  );
};
