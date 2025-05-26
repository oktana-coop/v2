import { useContext } from 'react';
import { Outlet, useParams } from 'react-router';

import { CurrentDocumentContext } from '../../../../../modules/editor-state';
import { FilesystemContext } from '../../../../../modules/filesystem';
import { isValidVersionControlId } from '../../../../../modules/version-control';
import { InvalidDocument } from '../../../components/document-views/InvalidDocument';
import { EmptyDocumentPage } from './empty';

export type DocumentMainViewRouterProps = {
  onCreateDocumentButtonClick: () => void;
};

export const DocumentMainViewRouter = ({
  onCreateDocumentButtonClick,
}: DocumentMainViewRouterProps) => {
  const { documentId: docUrl } = useParams();
  const { directory } = useContext(FilesystemContext);
  const { versionedDocumentHandle } = useContext(CurrentDocumentContext);

  if (!docUrl) {
    return (
      <EmptyDocumentPage
        directory={directory}
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
