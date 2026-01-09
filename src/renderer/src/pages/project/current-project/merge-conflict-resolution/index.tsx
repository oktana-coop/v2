import { useContext } from 'react';
import { Outlet } from 'react-router';

import { projectTypes } from '../../../../../../modules/domain/project';
import { CurrentProjectContext } from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument } from '../../../../hooks';
import { RecentProjects } from '../../shared/document-list-views';
import { MergeConflictsList } from './MergeConflictsList';

export const ProjectMergeConflictResolution = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { triggerDocumentCreationDialog } = useCreateDocument();

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-merge-conflict-resolution-panel-group">
          {projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
            <MergeConflictsList />
          ) : (
            <RecentProjects onCreateDocument={triggerDocumentCreationDialog} />
          )}
        </StackedResizablePanelsLayout>
      }
    >
      <Outlet />
    </SidebarLayout>
  );
};

export { CompareContentConflictResolution } from './CompareContentConflictResolution';
export { StructuralConflictResolution } from './structural';
