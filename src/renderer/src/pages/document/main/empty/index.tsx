import { projectTypes } from '../../../../../../modules/domain/project';
import { Button } from '../../../../components/actions/Button';
import { EmptyDocument } from '../../../../components/document-views/EmptyDocument';
import { FileDocumentIcon, PenIcon } from '../../../../components/icons';
import { useDocumentList as useDocumentListInMultiDocumentProject } from '../../../../hooks/multi-document-project';
import { useDocumentList as useDocumentListInSingleDocumentProject } from '../../../../hooks/single-document-project';

export const EmptyDocumentPage = ({
  onCreateDocumentButtonClick,
  onOpenDocumentButtonClick,
}: {
  onCreateDocumentButtonClick: () => void;
  onOpenDocumentButtonClick: () => void;
}) => {
  const getDocumentListInMultiDocumentProject =
    useDocumentListInMultiDocumentProject();
  const getDocumentListInSingleDocumentProject =
    useDocumentListInSingleDocumentProject();

  const documents = projectTypes.MULTI_DOCUMENT_PROJECT
    ? getDocumentListInMultiDocumentProject()
    : getDocumentListInSingleDocumentProject();

  return (
    <EmptyDocument
      message={
        documents.length > 0
          ? '👈 Pick one document from the list to continue editing. Or create a new one 😉.'
          : 'Create a new document and explore the world of versioning.'
      }
    >
      <Button
        onClick={onOpenDocumentButtonClick}
        variant="plain"
        color="purple"
      >
        <FileDocumentIcon className="mr-1" />
        Open document
      </Button>
      <Button
        onClick={onCreateDocumentButtonClick}
        variant="plain"
        color="purple"
      >
        <PenIcon className="mr-1" />
        Create document
      </Button>
    </EmptyDocument>
  );
};
