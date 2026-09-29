import { Button } from '../../../../components/actions/Button';
import { GroupIcon } from '../../../../components/icons';

export const JoinSharedDocumentButton = ({
  onClick,
}: {
  onClick: () => void;
}) => (
  <Button onClick={onClick} variant="plain" color="neutral" className="w-64">
    <GroupIcon className="mr-1" />
    Join shared document
  </Button>
);

export const SharedWithMeButton = ({ onClick }: { onClick: () => void }) => (
  <Button onClick={onClick} variant="plain" color="neutral" className="w-64">
    <GroupIcon className="mr-1" />
    Shared with me
  </Button>
);
