import { Directory } from '../../../../../../modules/filesystem';
import { Button } from '../../../../components/actions/Button';
import { EmptyDocument } from '../../../../components/document-views/EmptyDocument';
import { PenIcon } from '../../../../components/icons';

export const EmptyDocumentPage = ({
  directory,
  onCreateDocumentButtonClick,
}: {
  directory: Directory | null;
  onCreateDocumentButtonClick: () => void;
}) => (
  <EmptyDocument
    message={
      directory
        ? '👈 Pick one document from the list to continue editing. Or create a new one 😉.'
        : 'Create a new document and explore the world of versioning.'
    }
  >
    <Button
      onClick={onCreateDocumentButtonClick}
      variant="solid"
      color="purple"
    >
      <PenIcon />
      Create document
    </Button>
  </EmptyDocument>
);
