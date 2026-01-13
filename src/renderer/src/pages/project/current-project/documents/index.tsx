import { useContext } from 'react';
import { Outlet, useParams } from 'react-router';

export { DocumentEditor, DocumentHistoricalView } from './main';
import { projectTypes } from '../../../../../../modules/domain/project';
import { decodeUrlEncodedChangeId } from '../../../../../../modules/infrastructure/version-control';
import {
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../../app-state';
import { SidebarLayout } from '../../../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../../../components/layout/StackedResizablePanelsLayout';
import { useCreateDocument } from '../../../../hooks';
import {
  DirectoryFiles,
  RecentProjects,
} from '../../shared/document-list-views';
import { DocumentHistory } from './sidebar/document-history/DocumentHistory';

export const ProjectDocuments = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { versionedDocumentHistory: changes, onSelectChange } = useContext(
    CurrentDocumentContext
  );
  const { changeId } = useParams();
  const { triggerDocumentCreationDialog } = useCreateDocument();

  return (
    <SidebarLayout
      sidebar={
        <StackedResizablePanelsLayout autoSaveId="project-documents-panel-group">
          {projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
            <DirectoryFiles onCreateDocument={triggerDocumentCreationDialog} />
          ) : (
            <RecentProjects onCreateDocument={triggerDocumentCreationDialog} />
          )}

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
