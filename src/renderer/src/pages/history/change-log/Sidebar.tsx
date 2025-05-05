import {
  type Commit,
  type UncommitedChange,
} from '../../../../../modules/version-control';
import { CommitHistoryIcon } from '../../../components/icons';
import { SidebarHeading } from '../../../components/sidebar/SidebarHeading';
import { ChangeLog } from './ChangeLog';

export type ChangeLogSidebarProps = {
  commits: (Commit | UncommitedChange)[];
  onCommitClick: (hash: Commit['hash']) => void;
  selectedCommit?: Commit['hash'];
};

export const ChangeLogSidebar = ({
  commits,
  onCommitClick,
  selectedCommit,
}: ChangeLogSidebarProps) => {
  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center justify-between px-4 pb-4">
        <SidebarHeading icon={CommitHistoryIcon} text="Version History" />
      </div>
      <ChangeLog
        changes={commits}
        onClick={onCommitClick}
        selectedCommit={selectedCommit}
      />
    </div>
  );
};
