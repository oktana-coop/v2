import { useContext } from 'react';

import { ProjectContext, useCreateDocument } from '../../../../app-state';
import { EmptyMainView } from '../empty-main-view';

export const DocumentSelection = () => {
  const { startCreateDocument } = useCreateDocument();
  const { openDirectory } = useContext(ProjectContext);

  const handleOpenDirectory = () => openDirectory();
  const handleStartCreateDocument = () => startCreateDocument();

  return (
    <EmptyMainView
      onCreateDocumentButtonClick={handleStartCreateDocument}
      onOpenDirectoryButtonClick={handleOpenDirectory}
    />
  );
};
