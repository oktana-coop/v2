import { useContext } from 'react';

import { ProjectContext, useCreateDocument } from '../../../../app-state';
import { EmptyMainView } from '../empty-main-view';

export const DocumentSelection = () => {
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const { openDirectory } = useContext(ProjectContext);

  const handleOpenDirectory = () => openDirectory();

  return (
    <EmptyMainView
      onCreateDocumentButtonClick={triggerDocumentCreationDialog}
      onOpenDirectoryButtonClick={handleOpenDirectory}
    />
  );
};
