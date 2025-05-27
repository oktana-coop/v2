import { type File } from '../../../../../../modules/filesystem';
import { Button } from '../../../../components/actions/Button';
import { EmptyDocument } from '../../../../components/document-views/EmptyDocument';
import { PenIcon } from '../../../../components/icons';

export const EmptyDocumentPage = ({
  directoryFiles,
  onCreateDocumentButtonClick,
}: {
  directoryFiles: File[];
  onCreateDocumentButtonClick: () => void;
}) => (
  <EmptyDocument
    message={
      directoryFiles.length > 0
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
