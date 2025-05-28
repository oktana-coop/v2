import { useContext } from 'react';
import { Outlet, useParams } from 'react-router';

import { FilesystemContext } from '../../../../../modules/filesystem/react';
import { isValidVersionControlId } from '../../../../../modules/version-control';
import { VersionControlContext } from '../../../../../modules/version-control/react';
import { InvalidDocument } from '../../../components/document-views/InvalidDocument';
import { EmptyDocumentPage } from './empty';

export type DocumentMainViewRouterProps = {
  onCreateDocumentButtonClick: () => void;
};

export const DocumentMainViewRouter = ({
  onCreateDocumentButtonClick,
}: DocumentMainViewRouterProps) => {
  const { documentId: docUrl } = useParams();
  const { directoryFiles } = useContext(FilesystemContext);
  const { versionedDocumentHandle } = useContext(VersionControlContext);

  if (!docUrl) {
    return (
      <EmptyDocumentPage
        directoryFiles={directoryFiles}
        onCreateDocumentButtonClick={onCreateDocumentButtonClick}
      />
    );
  }

  if (!isValidVersionControlId(docUrl)) {
    return <InvalidDocument />;
  }

  if (!versionedDocumentHandle) {
    return (
      <div className="flex h-full w-full items-center justify-center text-center">
        Loading...
      </div>
    );
  }

  // Render nested routes
  // TODO: The drawback of this is that we cannot easily pass props to the nested routes.
  // Explore whether we can overcome this limitation.
  return <Outlet />;
};
