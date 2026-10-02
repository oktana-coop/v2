import { useContext } from 'react';

import { ProjectContext } from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { DefaultActionsBar } from '../../../shared/default-actions-bar';
import { DirectoryTreeView } from '../../shared/explorer-tree-views';
import { ProjectSync } from './ProjectSync';

export const ProjectSettings = () => {
  const { pendingNewDocument } = useContext(ProjectContext);

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-settings-panel-group">
          <DirectoryTreeView />
        </StackedResizablePanelsLayout>
      }
      needsSidebar={pendingNewDocument !== null}
    >
      <div className="flex w-full flex-col">
        <div className="w-full">
          <DefaultActionsBar />
        </div>
        <div className="container mx-auto my-6 flex max-w-2xl flex-col gap-16">
          <ProjectSync />
        </div>
      </div>
    </SidebarLayout>
  );
};
