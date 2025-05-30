import { useCallback, useContext, useState } from 'react';

import { CurrentDocumentContext } from '../../../../../../modules/app-state';
import { SidebarLayoutContext } from '../../../../../../modules/app-state/sidebar-layout/context';
import { ProseMirrorContext } from '../../../../../../modules/domain/rich-text/react/context';
import { RichTextEditor } from '../../../../components/editing/RichTextEditor';
import { ActionsBar } from './ActionsBar';

export const DocumentEditor = () => {
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const { view: editorView } = useContext(ProseMirrorContext);
  const { versionedDocumentHandle, onOpenCommitDialog, canCommit } = useContext(
    CurrentDocumentContext
  );
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);

  const handleEditorToolbarToggle = useCallback(() => {
    toggleEditorToolbar(!isEditorToolbarOpen);
    editorView?.focus();
  }, [editorView, isEditorToolbarOpen]);

  if (!versionedDocumentHandle) {
    return (
      // TODO: Use a spinner
      <div>Loading...</div>
    );
  }

  return (
    <div className="relative flex flex-auto flex-col items-stretch overflow-hidden">
      <ActionsBar
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={toggleSidebar}
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
  );
};
