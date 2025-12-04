import { type Branch } from '../../../../../../modules/infrastructure/version-control';
import { Button } from '../../../../components/actions/Button';
import { BranchIcon, ChevronDownIcon } from '../../../../components/icons';

export const BottomBar = ({
  currentBranch,
  onBranchButtonClick,
}: {
  currentBranch: Branch | null;
  onBranchButtonClick: () => void;
}) => (
  <div className="flex items-center justify-center bg-neutral-100 p-1.5 dark:bg-neutral-900">
    {currentBranch && (
      <Button
        variant="plain"
        color="purple"
        className="sm:py-0"
        onClick={onBranchButtonClick}
      >
        <BranchIcon />
        {currentBranch}
        <ChevronDownIcon />
      </Button>
    )}
  </div>
);
