import { useCreateDocument } from '../../../../hooks';
import { useOpenDirectory } from '../../../../hooks/multi-document-project';
import { useOpenDocument } from '../../../../hooks/single-document-project';
import { EmptyMainView } from '../empty-main-view';

export const DocumentSelection = () => {
  const { triggerDocumentCreationDialog } = useCreateDocument();
  const openDocument = useOpenDocument();
  const openDirectory = useOpenDirectory();

  const handleOpenDocument = () => openDocument();
  const handleOpenDirectory = () => openDirectory();

  return (
    <EmptyMainView
      onCreateDocumentButtonClick={triggerDocumentCreationDialog}
      onOpenDocumentButtonClick={handleOpenDocument}
      onOpenDirectoryButtonClick={handleOpenDirectory}
    />
  );
};
