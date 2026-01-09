import { useContext } from 'react';

import { SidebarLayoutContext } from '../../../../app-state';
import { DefaultActionsBar } from '../../../shared/default-actions-bar';

export const StructuralConflictResolution = () => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);

  return (
    <div className="flex w-full flex-col">
      <div className="w-full">
        <DefaultActionsBar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
        />
      </div>
      <div className="p-4">Structural Conflict Resolution</div>
    </div>
  );
};
