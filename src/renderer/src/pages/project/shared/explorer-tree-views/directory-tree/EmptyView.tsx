import { Button } from '../../../../../components/actions/Button';
import { PenIcon } from '../../../../../components/icons';

export const EmptyView = ({
  onCreateDocumentButtonClick,
}: {
  onCreateDocumentButtonClick: () => void;
}) => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <p>The directory has no documents.</p>
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
