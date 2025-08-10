import { useCallback, useContext, useState } from 'react';

import { ProseMirrorContext } from '../../../../../../modules/domain/rich-text/react/context';
import {
  CurrentDocumentContext,
  SidebarLayoutContext,
} from '../../../../app-state';
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
    <div className="relative flex flex-auto flex-col items-center overflow-hidden">
      <div className="w-full">
        <ActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          onEditorToolbarToggle={handleEditorToolbarToggle}
          canCommit={canCommit}
          onCheckIconClick={onOpenCommitDialog}
        />
      </div>

      <div className="flex w-full flex-auto flex-col items-center overflow-auto">
        <div className="flex w-full max-w-3xl flex-col">
          <RichTextEditor
            docHandle={versionedDocumentHandle}
            onSave={onOpenCommitDialog}
            isToolbarOpen={isEditorToolbarOpen}
          />
        </div>
      </div>
    </div>
  );
};
