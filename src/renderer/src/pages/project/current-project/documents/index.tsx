import { useContext } from 'react';
import { Outlet } from 'react-router';

export { DocumentEditor, DocumentHistoricalView } from './main';
import {
  CurrentArtifactVersioningContext,
  ProjectContext,
  useCurrentChangeId,
} from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { DirectoryTreeView } from '../../shared/explorer-tree-views';
import { DocumentHistory } from './sidebar/document-history/DocumentHistory';

export const ProjectDocuments = () => {
  const { versionedDocumentHistory: changes, onSelectChange } = useContext(
    CurrentArtifactVersioningContext
  );
  const { pendingNewDocument } = useContext(ProjectContext);
  const changeId = useCurrentChangeId();

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-documents-panel-group">
          <DirectoryTreeView />

          <DocumentHistory
            changes={changes}
            onChangeClick={onSelectChange}
            selectedChange={changeId}
          />
        </StackedResizablePanelsLayout>
      }
      needsSidebar={pendingNewDocument !== null}
    >
      <Outlet />
    </SidebarLayout>
  );
};
