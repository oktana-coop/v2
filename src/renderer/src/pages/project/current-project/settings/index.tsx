import { useContext } from 'react';

import { SidebarLayoutContext } from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument } from '../../../../hooks';
import { DefaultActionsBar } from '../../../shared/default-actions-bar';
import { DirectoryTreeView } from '../../shared/explorer-tree-views';
import { ProjectSync } from './ProjectSync';

export const ProjectSettings = () => {
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-settings-panel-group">
          <DirectoryTreeView onCreateDocument={triggerDocumentCreationDialog} />
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
        <div className="container mx-auto my-6 flex max-w-2xl flex-col gap-16">
          <ProjectSync />
        </div>
      </div>
    </SidebarLayout>
  );
};
