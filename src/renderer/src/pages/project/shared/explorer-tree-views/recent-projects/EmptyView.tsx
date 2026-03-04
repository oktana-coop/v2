import { Button } from '../../../../../components/actions/Button';
import {
  FileDocumentIcon,
  GithubIcon,
  PenIcon,
} from '../../../../../components/icons';

export const EmptyView = ({
  onCreateDocumentButtonClick,
  onOpenDocumentButtonClick,
  onCloneFromGithubButtonClick,
}: {
  onCreateDocumentButtonClick: () => void;
  onOpenDocumentButtonClick: () => void;
  onCloneFromGithubButtonClick: () => void;
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
      <Button
        onClick={onCloneFromGithubButtonClick}
        variant="solid"
        color="dark/zinc"
        className="w-64"
      >
        <GithubIcon className="mr-1" />
        Clone from GitHub
      </Button>
    </div>
  );
};
