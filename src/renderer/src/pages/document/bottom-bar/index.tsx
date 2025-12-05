import { type Branch } from '../../../../../modules/infrastructure/version-control';
import { Button } from '../../../components/actions/Button';
import { BranchIcon, ChevronDownIcon } from '../../../components/icons';

export const BottomBar = ({
  currentBranch,
  onBranchButtonClick,
}: {
  currentBranch: Branch | null;
  onBranchButtonClick: () => void;
}) => (
  <div className="flex items-center bg-neutral-100 p-1.5 dark:bg-neutral-900">
    {currentBranch && (
      <Button
        variant="plain"
        color="purple"
        // TODO: Implement small-sized button
        className="!py-0 !text-sm/6"
        onClick={onBranchButtonClick}
      >
        <BranchIcon />
        {currentBranch}
        <ChevronDownIcon />
      </Button>
    )}
  </div>
);
