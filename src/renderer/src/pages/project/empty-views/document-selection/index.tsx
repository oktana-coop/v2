import { useCreateDocument } from '../../../../hooks';
import { useOpenDirectory } from '../../../../hooks/multi-document-project';
import { EmptyMainView } from '../empty-main-view';

export const DocumentSelection = () => {
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const openDirectory = useOpenDirectory();

  const handleOpenDirectory = () => openDirectory();

  return (
    <EmptyMainView
      onCreateDocumentButtonClick={triggerDocumentCreationDialog}
      onOpenDirectoryButtonClick={handleOpenDirectory}
    />
  );
};
