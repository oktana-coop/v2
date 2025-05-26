import { useContext } from 'react';
import { Outlet, useParams } from 'react-router';

import {
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../../../modules/app-state';
import { isValidVersionControlId } from '../../../../../modules/infrastructure/version-control';
import { InvalidDocument } from '../../../components/document-views/InvalidDocument';
import { EmptyDocumentPage } from './empty';

export type DocumentMainViewRouterProps = {
  onCreateDocumentButtonClick: () => void;
  onOpenDocumentButtonClick: () => void;
};

export const DocumentMainViewRouter = ({
  onCreateDocumentButtonClick,
  onOpenDocumentButtonClick,
}: DocumentMainViewRouterProps) => {
  const { documentId: docUrl } = useParams();
  const { directoryFiles } = useContext(CurrentProjectContext);
  const { versionedDocumentHandle } = useContext(CurrentDocumentContext);

  if (!docUrl) {
    return (
      <EmptyDocumentPage
        directoryFiles={directoryFiles}
        onCreateDocumentButtonClick={onCreateDocumentButtonClick}
        onOpenDocumentButtonClick={onOpenDocumentButtonClick}
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
