import { useContext } from 'react';
import { Outlet } from 'react-router';

export { DocumentEditor, DocumentHistoricalView } from './main';
import {
  CurrentDocumentContext,
  useCreateDocument,
  useCurrentChangeId,
} from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { DirectoryTreeView } from '../../shared/explorer-tree-views';
import { DocumentHistory } from './sidebar/document-history/DocumentHistory';

export const ProjectDocuments = () => {
  const { versionedDocumentHistory: changes, onSelectChange } = useContext(
    CurrentDocumentContext
  );
  const changeId = useCurrentChangeId();
  const { triggerDocumentCreationDialog } = useCreateDocument();

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-documents-panel-group">
          <DirectoryTreeView onCreateDocument={triggerDocumentCreationDialog} />

          <DocumentHistory
            changes={changes}
            onChangeClick={onSelectChange}
            selectedChange={changeId}
          />
        </StackedResizablePanelsLayout>
      }
    >
      <Outlet />
    </SidebarLayout>
  );
};
