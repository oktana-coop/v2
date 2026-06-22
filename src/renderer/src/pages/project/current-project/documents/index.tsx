import { useContext } from 'react';
import { Outlet, useParams } from 'react-router';

export { DocumentEditor, DocumentHistoricalView } from './main';
import { decodeUrlEncodedChangeId } from '../../../../../../modules/infrastructure/version-control';
import { CurrentDocumentContext } from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument } from '../../../../hooks';
import { DirectoryTreeView } from '../../shared/explorer-tree-views';
import { DocumentHistory } from './sidebar/document-history/DocumentHistory';

export const ProjectDocuments = () => {
  const { versionedDocumentHistory: changes, onSelectChange } = useContext(
    CurrentDocumentContext
  );
  const { changeId } = useParams();
  const { triggerDocumentCreationDialog } = useCreateDocument();

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-documents-panel-group">
          <DirectoryTreeView onCreateDocument={triggerDocumentCreationDialog} />

          <DocumentHistory
            changes={changes}
            onChangeClick={onSelectChange}
            selectedChange={
              changeId ? decodeUrlEncodedChangeId(changeId) : null
            }
          />
        </StackedResizablePanelsLayout>
      }
    >
      <Outlet />
    </SidebarLayout>
  );
};
