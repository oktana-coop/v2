import { Outlet } from 'react-router';

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

  if (!documentId) {
    return (
      <EmptyDocumentPage
        onCreateDocumentButtonClick={onCreateDocumentButtonClick}
        onOpenDocumentButtonClick={onOpenDocumentButtonClick}
        onOpenDirectoryButtonClick={onOpenDirectoryButtonClick}
      />
    );
  }

  // Render nested routes
  // TODO: The drawback of this is that we cannot easily pass props to the nested routes.
  // Explore whether we can overcome this limitation.
  return <Outlet />;
};
