import { useCallback, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { ProseMirrorContext } from '../../../../../../../modules/domain/rich-text/react/prosemirror-context';
import { CompareContentConflict as CompareContentConflictType } from '../../../../../../../modules/infrastructure/version-control';
import { SidebarLayoutContext } from '../../../../../app-state';
import { LongTextSkeleton } from '../../../../../components/progress/skeletons/LongText';
import { useMergeConflictInfo } from '../../../../../hooks';
import { MergeConflictResolutionActionsBar } from '../ActionsBar';
import { CompareContentConflict } from './CompareContentConflict';

export const CompareContentConflictResolution = () => {
  const { compareContentPath } = useParams();
  const { view: editorView } = useContext(ProseMirrorContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const { mergeConflictInfo, compareContentConflicts, abortMerge } =
    useMergeConflictInfo();
  const [conflict, setConflict] = useState<CompareContentConflictType | null>(
    null
  );
  const [isEditorToolbarOpen, toggleEditorToolbar] = useState<boolean>(false);
  const [showDiff, setShowDiff] = useState<boolean>(true);

  useEffect(() => {
    const selectedConflict = compareContentConflicts.find(
      (conf) => conf.path === compareContentPath
    );
    setConflict(selectedConflict ?? null);
  }, [compareContentConflicts, compareContentPath]);

  const handleEditorToolbarToggle = useCallback(() => {
    toggleEditorToolbar(!isEditorToolbarOpen);
    editorView?.focus();
  }, [editorView, isEditorToolbarOpen]);

  const handleSetShowDiff = (checked: boolean) => {
    setShowDiff(checked);
  };

  const handleAbortMerge = () => {
    abortMerge();
  };

  if (!mergeConflictInfo) {
    return null;
  }

  return (
    <div className="relative flex w-full flex-col overflow-hidden">
      <div className="w-full">
        <MergeConflictResolutionActionsBar
          mergeConflictInfo={mergeConflictInfo}
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          hasEditorToolbarToggle={true}
          onEditorToolbarToggle={handleEditorToolbarToggle}
          onAbortMerge={handleAbortMerge}
          onResolveConflict={() => {}}
          hasShowDiffCheckbox={true}
          showDiff={showDiff}
          onSetShowDiffChecked={handleSetShowDiff}
        />
      </div>
      <div className="flex w-full flex-auto flex-col items-center overflow-auto">
        <div className="flex w-full max-w-3xl flex-col">
          {conflict ? (
            <CompareContentConflict
              conflict={conflict}
              mergeConflictInfo={mergeConflictInfo}
              isEditorToolbarOpen={isEditorToolbarOpen}
              showDiff={showDiff}
            />
          ) : (
            <LongTextSkeleton />
          )}
        </div>
      </div>
    </div>
  );
};
