import { Button } from '../../../../../../../components/actions/Button';
import {
  FileDocumentIcon,
  PenIcon,
} from '../../../../../../../components/icons';

export const EmptyView = ({
  onCreateDocumentButtonClick,
  onOpenDocumentButtonClick,
}: {
  onCreateDocumentButtonClick: () => void;
  onOpenDocumentButtonClick: () => void;
}) => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Button
        onClick={onOpenDocumentButtonClick}
        variant="solid"
        color="purple"
        className="w-64"
      >
        <FileDocumentIcon className="mr-1" />
        Open document
      </Button>
      <Button
        onClick={onCreateDocumentButtonClick}
        variant="solid"
        color="purple"
        className="w-64"
      >
        <PenIcon className="mr-1" />
        Create document
      </Button>
    </div>
  );
};
