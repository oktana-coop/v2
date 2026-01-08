import { useContext } from 'react';

import { projectTypes } from '../../../../../../modules/domain/project';
import {
  CurrentProjectContext,
  SidebarLayoutContext,
} from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument } from '../../../../hooks';
import { DefaultActionsBar } from '../../../shared/default-actions-bar';
import {
  DirectoryFiles,
  RecentProjects,
} from '../../shared/document-list-views';

export const ProjectMergeConflictResolution = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-merge-conflict-resolution-panel-group">
          {projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
            <DirectoryFiles onCreateDocument={triggerDocumentCreationDialog} />
          ) : (
            <RecentProjects onCreateDocument={triggerDocumentCreationDialog} />
          )}
        </StackedResizablePanelsLayout>
      }
    >
      <div className="flex w-full flex-col">
        <div className="w-full">
          <DefaultActionsBar
            isSidebarOpen={isSidebarOpen}
            onSidebarToggle={toggleSidebar}
          />
        </div>
        <div className="p-4">Merge Conflict Resolution Screen</div>
      </div>
    </SidebarLayout>
  );
};
