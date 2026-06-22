import { Outlet } from 'react-router';

import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { MergeConflictsList } from './MergeConflictsList';

export const ProjectMergeConflictResolution = () => {
  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-merge-conflict-resolution-panel-group">
          <MergeConflictsList />
        </StackedResizablePanelsLayout>
      }
    >
      <Outlet />
    </SidebarLayout>
  );
};

export { CompareContentConflictResolution } from './compare-content';
export { StructuralConflictResolution } from './structural';
