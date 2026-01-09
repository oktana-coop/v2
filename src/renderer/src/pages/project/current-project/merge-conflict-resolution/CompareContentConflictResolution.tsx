import { useContext } from 'react';

import { SidebarLayoutContext } from '../../../../app-state';
import { MergeConflictResolutionActionsBar } from './ActionsBar';

export const CompareContentConflictResolution = () => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);

  return (
    <div className="flex w-full flex-col">
      <div className="w-full">
        <MergeConflictResolutionActionsBar
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
