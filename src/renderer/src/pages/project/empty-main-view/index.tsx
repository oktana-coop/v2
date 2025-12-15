import { useContext } from 'react';

import { projectTypes } from '../../../../../modules/domain/project';
import { CurrentProjectContext } from '../../../app-state';
import { Button } from '../../../components/actions/Button';
import { EmptyDocument } from '../../../components/document-views/EmptyDocument';
import {
  FileDocumentIcon,
  FolderIcon,
  PenIcon,
} from '../../../components/icons';
import { useCreateDocument, useDocumentList } from '../../../hooks';

export const EmptyMainView = ({
  onCreateDocumentButtonClick,
  onOpenDocumentButtonClick,
  onOpenDirectoryButtonClick,
}: {
  onCreateDocumentButtonClick: () => void;
  onOpenDocumentButtonClick: () => void;
  onOpenDirectoryButtonClick: () => void;
}) => {
  const { projectType } = useContext(CurrentProjectContext);
  const { documentList: documents } = useDocumentList();
  const { canCreateDocument } = useCreateDocument();

  const openProjectPrompt =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? 'Open a folder to organize your versioned documents'
      : 'Create a new document';

  return (
    <EmptyDocument
      message={
        documents.length > 0
          ? '👈 Pick one document from the list to continue editing. Or create a new one 😉.'
          : openProjectPrompt
      }
    >
      {projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
        <Button
          onClick={onOpenDirectoryButtonClick}
          variant="plain"
          color="purple"
        >
          <FolderIcon className="mr-1" />
          Open folder
        </Button>
      ) : (
        <Button
          onClick={onOpenDocumentButtonClick}
          variant="plain"
          color="purple"
        >
          <FileDocumentIcon className="mr-1" />
          Open document
        </Button>
      )}
      {canCreateDocument && (
        <Button
          onClick={onCreateDocumentButtonClick}
          variant="plain"
          color="purple"
        >
          <PenIcon className="mr-1" />
          Create document
        </Button>
      )}
    </EmptyDocument>
  );
};
