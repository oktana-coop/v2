import { useCallback, useContext, useState } from 'react';

import { ProseMirrorContext } from '../../../../../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  CommitModalContext,
  CurrentDocumentContext,
  SidebarLayoutContext,
} from '../../../../../../app-state';
import { RichTextEditor } from '../../../../../../components/editing/RichTextEditor';
import { LongTextSkeleton } from '../../../../../../components/progress/skeletons/LongText';
import {
  useAssetInsertion,
  useAssetSrcResolver,
} from '../../../../../../hooks';
import { ActionsBar } from './ActionsBar';

export const DocumentEditor = () => {
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const { view: editorView } = useContext(ProseMirrorContext);
  const {
    versionedDocument,
    versionedDocumentHandle,
    onDocumentContentChange,
    canCommit,
  } = useContext(CurrentDocumentContext);
  const { openCommitModal } = useContext(CommitModalContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const resolveAssetSrc = useAssetSrcResolver();
  const pickAsset = useAssetInsertion();

  const handleEditorToolbarToggle = useCallback(() => {
    toggleEditorToolbar(!isEditorToolbarOpen);
    editorView?.focus();
  }, [editorView, isEditorToolbarOpen]);

  return (
    <div className="relative flex flex-auto flex-col items-center overflow-hidden">
      <div className="w-full">
        <ActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          onEditorToolbarToggle={handleEditorToolbarToggle}
          canCommit={canCommit}
          onCheckIconClick={openCommitModal}
        />
      </div>

      <div className="flex w-full flex-auto flex-col items-center overflow-auto">
        <div className="flex w-full max-w-3xl flex-col">
          {versionedDocument ? (
            <RichTextEditor
              doc={versionedDocument}
              docHandle={versionedDocumentHandle}
              isToolbarOpen={isEditorToolbarOpen}
              onDocChange={onDocumentContentChange}
              pickAsset={pickAsset}
              resolveAssetSrc={resolveAssetSrc}
            />
          ) : (
            <LongTextSkeleton />
          )}
        </div>
      </div>
    </div>
  );
};
