import { useContext } from 'react';

import { SidebarLayoutContext } from '../../../../../app-state';
import { useMergeConflictInfo } from '../../../../../hooks';
import { MergeConflictResolutionActionsBar } from '../ActionsBar';

export const CompareContentConflictResolution = () => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const { mergeConflictInfo } = useMergeConflictInfo();

  if (!mergeConflictInfo) {
    return null;
  }

  return (
    <div className="flex w-full flex-col">
      <div className="w-full">
        <MergeConflictResolutionActionsBar
          mergeConflictInfo={mergeConflictInfo}
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          onAbortMerge={() => {}}
          onResolveConflict={() => {}}
        />
      </div>
      <div className="p-4">Compare Content Conflict Resolution</div>
    </div>
  );
};
