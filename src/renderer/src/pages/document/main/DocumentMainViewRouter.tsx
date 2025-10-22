import { useContext } from 'react';
import { Outlet } from 'react-router';

import { CurrentDocumentContext } from '../../../app-state';
import { useCurrentDocumentId } from '../../../hooks';
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

  if (!documentId) {
    return (
      <EmptyDocumentPage
        onCreateDocumentButtonClick={onCreateDocumentButtonClick}
        onOpenDocumentButtonClick={onOpenDocumentButtonClick}
        onOpenDirectoryButtonClick={onOpenDirectoryButtonClick}
      />
    );
  }

  if (!versionedDocument) {
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
