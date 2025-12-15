import { useContext } from 'react';

import { projectTypes } from '../../../../../../modules/domain/project';
import { CurrentProjectContext } from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument } from '../../../../hooks';
import {
  DirectoryFiles,
  RecentProjects,
} from '../../shared/document-list-views';

export const ProjectSettings = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { triggerDocumentCreationDialog } = useCreateDocument();

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-settings-panel-group">
          {projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
            <DirectoryFiles onCreateDocument={triggerDocumentCreationDialog} />
          ) : (
            <RecentProjects onCreateDocument={triggerDocumentCreationDialog} />
          )}
        </StackedResizablePanelsLayout>
      }
    >
      <div className="p-6">Project Settings Page (WIP)</div>
    </SidebarLayout>
  );
};
