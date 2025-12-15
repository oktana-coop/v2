import { Link } from 'react-router';

import {
  type ProjectId,
  urlEncodeProjectId,
} from '../../../../../../modules/domain/project';
import { type Branch } from '../../../../../../modules/infrastructure/version-control';
import { Button } from '../../../../components/actions/Button';
import {
  BranchIcon,
  ChevronDownIcon,
  OptionsIcon,
} from '../../../../components/icons';

export const BottomBar = ({
  projectId,
  currentBranch,
  onBranchButtonClick,
}: {
  projectId: ProjectId;
  currentBranch: Branch | null;
  onBranchButtonClick: () => void;
}) => (
  <div className="flex items-center justify-between bg-neutral-100 p-1.5 dark:bg-neutral-900">
    <div className="flex inline-flex">
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
    <div className="flex inline-flex">
      <Button
        variant="plain"
        color="purple"
        // TODO: Implement small-sized button
        className="!py-0 !text-sm/6"
        to={`/projects/${urlEncodeProjectId(projectId)}/settings`}
      >
        <OptionsIcon />
        Project Settings
      </Button>
    </div>
  </div>
);
