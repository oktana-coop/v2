import { IconButton } from '../../../components/actions/IconButton';
import { CheckIcon } from '../../../components/icons';

export type CommitAction = { canCommit: boolean; onCommitClick: () => void };

export const CommitButton = ({
  commitAction,
}: {
  commitAction: CommitAction;
}) => {
  const handleCommitClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    commitAction.onCommitClick();
  };

  return (
    <IconButton
      onClick={handleCommitClick}
      icon={<CheckIcon />}
      color="purple"
      disabled={!commitAction.canCommit}
      tooltip="Commit Changes"
    />
  );
};
