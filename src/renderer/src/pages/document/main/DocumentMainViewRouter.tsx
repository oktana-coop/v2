import { useContext } from 'react';
import { Outlet } from 'react-router';

import { CurrentDocumentContext } from '../../../app-state';
import { LoadingText } from '../../../components/progress/LoadingText';
import { useCurrentDocumentId, useLoadingProject } from '../../../hooks';
import { EmptyDocumentPage } from './empty';

export type DocumentMainViewRouterProps = {
  onCreateDocumentButtonClick: () => void;
  onOpenDocumentButtonClick: () => void;
  onOpenDirectoryButtonClick: () => void;
};

export const DocumentMainViewRouter = ({
  onCreateDocumentButtonClick,
  onOpenDocumentButtonClick,
  onOpenDirectoryButtonClick,
}: DocumentMainViewRouterProps) => {
  const documentId = useCurrentDocumentId();
  const { versionedDocument } = useContext(CurrentDocumentContext);
  const loading = useLoadingProject();

  if (!documentId) {
    return (
      <EmptyDocumentPage
        onCreateDocumentButtonClick={onCreateDocumentButtonClick}
        onOpenDocumentButtonClick={onOpenDocumentButtonClick}
        onOpenDirectoryButtonClick={onOpenDirectoryButtonClick}
      />
    );
  }

  if (loading || !versionedDocument) {
    return <LoadingText />;
  }

  // Render nested routes
  // TODO: The drawback of this is that we cannot easily pass props to the nested routes.
  // Explore whether we can overcome this limitation.
  return <Outlet />;
};
